"""
CityU Digital Twin - Energy Forecasting & Anomaly Detection
============================================================

This script:
1. Pulls hourly energy readings from MongoDB
2. Engineers features (hour, day-of-week, month, is_weekend)
3. Trains a linear regression model on 80% of the data (chronological split)
4. Evaluates on the remaining 20% (MAE, RMSE)
5. Detects anomalies using z-score on forecast residuals
6. Generates a 24-hour-ahead forecast
7. Stores everything back into MongoDB for the dashboard to display
8. Saves evaluation charts as PNG files

Run: python forecast.py
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
import numpy as np
import pandas as pd
from pymongo import MongoClient
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

# Load the same .env as the backend
BACKEND_ENV = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
if os.path.exists(BACKEND_ENV):
    load_dotenv(BACKEND_ENV)
else:
    load_dotenv()

MONGO_URI = os.environ.get('MONGODB_URI')
if not MONGO_URI:
    print("ERROR: MONGODB_URI not found. Set it in backend/.env or ml/.env")
    sys.exit(1)

CO2_FACTOR = 0.34  # CLP Hong Kong, kg CO2e per kWh
ANOMALY_THRESHOLD = 2.5  # z-score threshold for anomaly flagging


def connect_db():
    """Connect to MongoDB and return the database."""
    client = MongoClient(MONGO_URI)
    db = client['cityu-digital-twin']
    print(f"Connected to MongoDB: {client.address}")
    return db


def load_readings(db):
    """Pull all energy_kwh readings, aggregate by hour."""
    print("Loading sensor readings...")

    pipeline = [
        {'$match': {'metricType': 'energy_kwh'}},
        {'$group': {
            '_id': {
                'year': {'$year': '$timestamp'},
                'month': {'$month': '$timestamp'},
                'day': {'$dayOfMonth': '$timestamp'},
                'hour': {'$hour': '$timestamp'},
                'dow': {'$dayOfWeek': '$timestamp'},  # 1=Sun, 7=Sat
            },
            'totalKwh': {'$sum': '$value'},
            'timestamp': {'$first': '$timestamp'},
        }},
        {'$sort': {'timestamp': 1}},
    ]

    results = list(db.sensorreadings.aggregate(pipeline, allowDiskUse=True))
    print(f"  Loaded {len(results)} hourly data points")

    if len(results) == 0:
        print("ERROR: No readings found. Run the synthetic generator first.")
        sys.exit(1)

    # Convert to DataFrame
    rows = []
    for r in results:
        rows.append({
            'timestamp': r['timestamp'],
            'hour': r['_id']['hour'],
            'month': r['_id']['month'],
            'dow': r['_id']['dow'],
            'totalKwh': r['totalKwh'],
        })

    df = pd.DataFrame(rows)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)

    # Feature engineering
    df['is_weekend'] = df['dow'].isin([1, 7]).astype(int)  # MongoDB: 1=Sun, 7=Sat

    # One-hot encode hour (0-23) and day-of-week (1-7)
    hour_dummies = pd.get_dummies(df['hour'], prefix='h', dtype=int)
    dow_dummies = pd.get_dummies(df['dow'], prefix='dow', dtype=int)
    month_dummies = pd.get_dummies(df['month'], prefix='m', dtype=int)

    features = pd.concat([hour_dummies, dow_dummies, month_dummies, df[['is_weekend']]], axis=1)

    print(f"  Feature matrix shape: {features.shape}")
    print(f"  Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"  Mean hourly kWh: {df['totalKwh'].mean():.0f}")

    return df, features


def train_model(df, features):
    """
    Train a linear regression model with a chronological train/test split.

    IMPORTANT: We use a TIME-BASED split (first 80%, last 20%), never a random
    shuffle. Random shuffle on time series leaks future information into
    training and produces unrealistically good metrics.
    """
    print("\nTraining model...")

    split_idx = int(len(df) * 0.8)
    X_train = features.iloc[:split_idx]
    X_test = features.iloc[split_idx:]
    y_train = df['totalKwh'].iloc[:split_idx]
    y_test = df['totalKwh'].iloc[split_idx:]

    train_end = df['timestamp'].iloc[split_idx - 1]
    test_start = df['timestamp'].iloc[split_idx]

    print(f"  Train: {len(X_train)} samples (up to {train_end.date()})")
    print(f"  Test:  {len(X_test)} samples (from {test_start.date()})")

    model = LinearRegression()
    model.fit(X_train, y_train)

    # Predictions
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # Metrics on TEST set (the only ones that matter)
    mae = mean_absolute_error(y_test, y_pred_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))

    # Also compute train metrics to check for overfitting
    train_mae = mean_absolute_error(y_train, y_pred_train)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))

    print(f"\n  === Model Evaluation ===")
    print(f"  Train MAE:  {train_mae:.0f} kWh")
    print(f"  Train RMSE: {train_rmse:.0f} kWh")
    print(f"  Test MAE:   {mae:.0f} kWh")
    print(f"  Test RMSE:  {rmse:.0f} kWh")
    print(f"  Mean test value: {y_test.mean():.0f} kWh")
    print(f"  MAE as % of mean: {(mae / y_test.mean()) * 100:.1f}%")

    return model, {
        'mae': round(float(mae), 2),
        'rmse': round(float(rmse), 2),
        'train_mae': round(float(train_mae), 2),
        'train_rmse': round(float(train_rmse), 2),
        'split_idx': split_idx,
        'train_end': train_end,
        'test_start': test_start,
    }, y_test, y_pred_test


def detect_anomalies(df, features, model, metrics):
    """
    Anomaly detection using z-score on forecast residuals.

    For each reading, compute: residual = actual - predicted.
    Flag if abs(z-score of residual) > ANOMALY_THRESHOLD.
    """
    print("\nRunning anomaly detection...")

    y_pred_all = model.predict(features)
    residuals = df['totalKwh'].values - y_pred_all

    residual_mean = residuals.mean()
    residual_std = residuals.std()

    z_scores = (residuals - residual_mean) / residual_std
    anomaly_mask = np.abs(z_scores) > ANOMALY_THRESHOLD

    anomaly_count = anomaly_mask.sum()
    print(f"  Residual mean: {residual_mean:.0f} kWh")
    print(f"  Residual std:  {residual_std:.0f} kWh")
    print(f"  Threshold:     {ANOMALY_THRESHOLD} std deviations")
    print(f"  Anomalies found: {anomaly_count} / {len(df)} ({anomaly_count/len(df)*100:.1f}%)")

    anomalies = []
    for idx in np.where(anomaly_mask)[0]:
        row = df.iloc[idx]
        anomalies.append({
            'timestamp': row['timestamp'],
            'actual': float(row['totalKwh']),
            'predicted': float(y_pred_all[idx]),
            'residual': float(residuals[idx]),
            'z_score': float(z_scores[idx]),
        })

    return anomalies, residuals, z_scores


def generate_forecast(model, features, df):
    """
    Generate a 24-hour-ahead forecast from the last data point.
    """
    print("\nGenerating 24-hour forecast...")

    last_ts = df['timestamp'].iloc[-1]
    forecast_start = last_ts + timedelta(hours=1)

    predictions = []
    for h in range(24):
        ts = forecast_start + timedelta(hours=h)
        hour = ts.hour
        dow = ts.isoweekday()  # 1=Mon, 7=Sun -> remap to MongoDB: 1=Sun,2=Mon...7=Sat
        mongo_dow = (dow % 7) + 1
        month = ts.month
        is_weekend = 1 if dow >= 6 else 0

        # Build feature vector matching training columns
        feat = {}
        for col in features.columns:
            feat[col] = 0

        feat[f'h_{hour}'] = 1
        feat[f'dow_{mongo_dow}'] = 1
        feat[f'm_{month}'] = 1
        feat['is_weekend'] = is_weekend

        feat_df = pd.DataFrame([feat])
        # Ensure columns match
        for col in features.columns:
            if col not in feat_df.columns:
                feat_df[col] = 0
        feat_df = feat_df[features.columns]

        pred = model.predict(feat_df)[0]
        predictions.append({
            'timestamp': ts,
            'predictedKwh': round(float(max(0, pred)), 2),
        })

    print(f"  Forecast: {predictions[0]['timestamp']} to {predictions[-1]['timestamp']}")
    print(f"  Predicted range: {min(p['predictedKwh'] for p in predictions):.0f} - {max(p['predictedKwh'] for p in predictions):.0f} kWh")

    return predictions


def save_to_mongodb(db, metrics, predictions, anomalies, df):
    """Store forecast results, anomalies as alerts, and model metrics in MongoDB."""
    print("\nSaving results to MongoDB...")

    # Get building ID
    building = db.buildingprofiles.find_one({'name': {'$regex': 'YEUNG', '$options': 'i'}})
    if not building:
        print("WARNING: YEUNG building not found. Skipping MongoDB save.")
        return

    building_id = building['_id']

    # Save forecast
    forecast_doc = {
        'buildingId': building_id,
        'generatedAt': datetime.utcnow(),
        'forecastHorizon': 24,
        'predictions': [
            {'timestamp': p['timestamp'], 'predictedKwh': p['predictedKwh']}
            for p in predictions
        ],
        'modelMetrics': {
            'mae': metrics['mae'],
            'rmse': metrics['rmse'],
            'modelType': 'LinearRegression',
            'trainPeriod': {
                'from': df['timestamp'].iloc[0],
                'to': metrics['train_end'],
            },
            'testPeriod': {
                'from': metrics['test_start'],
                'to': df['timestamp'].iloc[-1],
            },
        },
    }

    db.forecasts.delete_many({'buildingId': building_id})
    db.forecasts.insert_one(forecast_doc)
    print(f"  Saved forecast ({len(predictions)} predictions)")

    # Save anomalies as alerts
    alert_count = 0
    for a in anomalies[:20]:  # Cap at 20 to avoid flooding
        severity = 'high' if abs(a['z_score']) > 3.5 else 'medium' if abs(a['z_score']) > 3.0 else 'low'
        db.alerts.update_one(
            {'buildingId': building_id, 'timestamp': a['timestamp'], 'type': 'anomaly'},
            {'$set': {
                'buildingId': building_id,
                'timestamp': a['timestamp'],
                'type': 'anomaly',
                'severity': severity,
                'message': f"Energy reading {a['actual']:.0f} kWh deviates from forecast {a['predicted']:.0f} kWh (z-score: {a['z_score']:.1f})",
                'resolved': False,
                'metadata': {
                    'actualValue': a['actual'],
                    'expectedValue': a['predicted'],
                    'residual': a['residual'],
                },
            }},
            upsert=True,
        )
        alert_count += 1

    print(f"  Saved {alert_count} anomaly alerts")


def save_plots(df, y_test, y_pred_test, residuals, z_scores, metrics, predictions):
    """Generate evaluation plots and save as PNG."""
    print("\nGenerating plots...")

    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('CityU YEUNG Building - Energy Forecast Evaluation', fontsize=14, fontweight='bold')

    # 1. Actual vs Predicted (test set)
    ax1 = axes[0, 0]
    test_len = min(200, len(y_test))
    ax1.plot(range(test_len), y_test.values[:test_len], label='Actual', alpha=0.7, linewidth=0.8)
    ax1.plot(range(test_len), y_pred_test[:test_len], label='Predicted', alpha=0.7, linewidth=0.8)
    ax1.set_title(f'Actual vs Predicted (Test Set, first {test_len}h)')
    ax1.set_xlabel('Hours')
    ax1.set_ylabel('kWh')
    ax1.legend(fontsize=8)
    ax1.text(0.02, 0.95, f'MAE: {metrics["mae"]:.0f} kWh\nRMSE: {metrics["rmse"]:.0f} kWh',
             transform=ax1.transAxes, fontsize=8, verticalalignment='top',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    # 2. Residual distribution
    ax2 = axes[0, 1]
    ax2.hist(residuals, bins=50, color='steelblue', alpha=0.7, edgecolor='black', linewidth=0.3)
    ax2.axvline(x=0, color='red', linestyle='--', linewidth=1)
    ax2.set_title('Residual Distribution')
    ax2.set_xlabel('Residual (Actual - Predicted) kWh')
    ax2.set_ylabel('Frequency')

    # 3. Z-score timeline with anomalies
    ax3 = axes[1, 0]
    ax3.plot(range(len(z_scores)), z_scores, alpha=0.4, linewidth=0.5, color='gray')
    anomaly_idx = np.where(np.abs(z_scores) > ANOMALY_THRESHOLD)[0]
    ax3.scatter(anomaly_idx, z_scores[anomaly_idx], c='red', s=10, zorder=5, label=f'Anomalies ({len(anomaly_idx)})')
    ax3.axhline(y=ANOMALY_THRESHOLD, color='orange', linestyle='--', linewidth=0.8, label=f'Threshold (+-{ANOMALY_THRESHOLD})')
    ax3.axhline(y=-ANOMALY_THRESHOLD, color='orange', linestyle='--', linewidth=0.8)
    ax3.set_title('Z-Score Timeline')
    ax3.set_xlabel('Hours')
    ax3.set_ylabel('Z-Score')
    ax3.legend(fontsize=8)

    # 4. 24-hour forecast
    ax4 = axes[1, 1]
    hours = [p['timestamp'].hour for p in predictions]
    kwh = [p['predictedKwh'] for p in predictions]
    ax4.bar(hours, kwh, color='teal', alpha=0.7, edgecolor='black', linewidth=0.3)
    ax4.set_title('24-Hour Ahead Forecast')
    ax4.set_xlabel('Hour of Day')
    ax4.set_ylabel('Predicted kWh')
    ax4.set_xticks(range(0, 24, 3))

    plt.tight_layout()
    plot_path = os.path.join(output_dir, 'forecast_evaluation.png')
    plt.savefig(plot_path, dpi=150)
    plt.close()
    print(f"  Saved: {plot_path}")


def main():
    print("=" * 60)
    print("CityU Digital Twin - Energy Forecasting Pipeline")
    print("=" * 60)

    db = connect_db()
    df, features = load_readings(db)
    model, metrics, y_test, y_pred_test = train_model(df, features)
    anomalies, residuals, z_scores = detect_anomalies(df, features, model, metrics)
    predictions = generate_forecast(model, features, df)
    save_to_mongodb(db, metrics, predictions, anomalies, df)
    save_plots(df, y_test, y_pred_test, residuals, z_scores, metrics, predictions)

    print("\n" + "=" * 60)
    print("DONE. Key numbers to remember for the interview:")
    print(f"  Test MAE:  {metrics['mae']:.0f} kWh ({(metrics['mae'] / df['totalKwh'].mean()) * 100:.1f}% of mean)")
    print(f"  Test RMSE: {metrics['rmse']:.0f} kWh")
    print(f"  Anomalies: {len(anomalies)} flagged (z-score > {ANOMALY_THRESHOLD})")
    print(f"  Model:     Linear Regression with hour/dow/month one-hot features")
    print(f"  Split:     80/20 chronological (never random shuffle for time series)")
    print("=" * 60)


if __name__ == '__main__':
    main()
