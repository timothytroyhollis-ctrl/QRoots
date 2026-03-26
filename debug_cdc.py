import pandas as pd

df = pd.read_csv(
    'data/raw/PLACES__Local_Data_for_Better_Health,_Census_Tract_Data,_2025_release_20260326.csv',
    usecols=['LocationID', 'Category', 'Measure', 'Data_Value']
)

target = [
    'Frequent mental distress among adults',
    'Depression among adults',
    'Fair or poor self-rated health status among adults',
]

filtered = df.loc[df['Measure'].isin(target)]
print(f'Filtered rows: {len(filtered):,}')
print(f'Unique tracts: {filtered["LocationID"].nunique():,}')
print(f'Measure counts:\n{filtered["Measure"].value_counts()}')
