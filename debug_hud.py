import json
import requests

token = json.load(open('hud_config.json'))['api_token']
r = requests.get(
    'https://www.huduser.gov/hudapi/public/fmr/statedata/AL',
    headers={'Authorization': f'Bearer {token}'},
    params={'year': 2022}
)
print(r.status_code)
print(r.text[:1000])