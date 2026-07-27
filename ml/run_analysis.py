"""
Campus Decarbonisation Decision-Support System - Run All
=========================================================

This script runs the full pipeline:
1. Generate the BDG2-calibrated education building portfolio
2. Run the complete analysis engine (9 pillars)
3. Save results to output/

Usage: python run_analysis.py
"""
import sys
import os

# Add analysis directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'analysis'))

print("\n" + "=" * 60)
print("  STEP 1: Generating Building Portfolio")
print("=" * 60)
from generate_portfolio import generate_portfolio
import json

data_dir = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(data_dir, exist_ok=True)

buildings, readings = generate_portfolio()

# Save metadata CSV
import pandas as pd
meta_df = pd.DataFrame([{k: v for k, v in b.items() if k != 'changepoint_params'} for b in buildings])
meta_df.to_csv(os.path.join(data_dir, 'portfolio_metadata.csv'), index=False)

# Save building details JSON
with open(os.path.join(data_dir, 'portfolio_buildings.json'), 'w') as f:
    json.dump(buildings, f, indent=2, default=str)

# Save readings CSVs
readings_dir = os.path.join(data_dir, 'readings')
os.makedirs(readings_dir, exist_ok=True)
for bid, rdata in readings.items():
    df = pd.DataFrame(rdata)
    df.to_csv(os.path.join(readings_dir, f'{bid}.csv'), index=False)

print(f"Saved {len(buildings)} buildings and {len(readings)} reading files")

print("\n" + "=" * 60)
print("  STEP 2: Running Analysis Engine")
print("=" * 60)
from analysis_engine import run_full_analysis
results = run_full_analysis()

print("\n" + "=" * 60)
print("  ALL DONE")
print("=" * 60)
print(f"\nOutput files:")
print(f"  data/portfolio_metadata.csv")
print(f"  data/portfolio_buildings.json")
print(f"  data/readings/ ({len(readings)} CSV files)")
print(f"  output/analysis_results.json")
print(f"  output/analysis_dashboard.png")
