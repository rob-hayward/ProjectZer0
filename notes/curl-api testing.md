http://localhost:3000/api/auth/login

# Set your environment variables for zsh
export USER_ID="google-oauth2|113247584252508452361"
export JWT_COOKIE="jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDExMzI0NzU4NDI1MjUwODQ1MjM2MSIsImVtYWlsIjoiaGF5d2FyZC5tLnJvYkBnbWFpbC5jb20iLCJpYXQiOjE3NjAwOTQ2NzMsImV4cCI6MTc2MDA5ODI3MywiYXVkIjoiaHR0cHM6Ly9wcm9qZWN0LXplcm8tYXBpIiwiaXNzIjoiaHR0cHM6Ly9kZXYtZTRlY3RnOHFvN2V4b2RtNy51cy5hdXRoMC5jb20vIn0._kgFwRBqyNKIgK4avWk6i8Qqe3w8P_x--QGB0wfXMnc"
export API_BASE="http://localhost:3000/api"

# Now create the word "word" with COOKIE authentication
curl -X POST "${API_BASE}/words" \
  -H "Cookie: ${JWT_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "word": "word",
    "publicCredit": true,
    "initialComment": "The first word in the database!"
  }'