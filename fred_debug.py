import json
from fredapi import Fred

fred = Fred(api_key=json.load(open('fred_config.json'))['api_key'])
series = fred.get_series('01001UR')
print(series)