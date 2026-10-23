# Geoapify geocoding setup

The `/api/geocode` endpoint uses Geoapify Geocoding API.

## Configure Vercel

1. Create a project and API key at https://myprojects.geoapify.com/.
2. In Vercel, open the expense-report app project, then **Settings → Environment Variables**.
3. Add `GEOAPIFY_API_KEY` with the Geoapify key as its value.
4. Enable it for the environments where the app is deployed (Production, and Preview if needed).
5. Redeploy the app after saving the variable.

The key is read only by the server-side API route. Do not add it to a `VITE_*` variable or expose it in frontend code.

## Limits and attribution

The Geoapify Free plan currently lists 3,000 credits per day, with one credit per ordinary geocoding request. Review the current plan and terms before production rollout:
- https://www.geoapify.com/pricing/
- https://apidocs.geoapify.com/docs/geocoding/
- https://www.geoapify.com/terms-and-conditions/

The UI displays Geoapify and OpenStreetMap attribution. Stay within the selected plan's quota and attribution requirements.

## Smoke test

After deployment, sign in to the app and search for both departure and arrival locations. Test several known Okinawa addresses, including city-level and street/house-number queries. Confirm that the returned candidate label matches the intended address before calculating the route. If the API key is missing or invalid, the endpoint returns an explicit configuration/authentication error rather than silently falling back to a different provider.
