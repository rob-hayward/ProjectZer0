ProjectZer0
ProjectZer0 is a web application designed to [briefly describe the purpose or goal of your application].

Project Structure
Frontend (ProjectZer0Frontend)
Framework: Svelte
Language: TypeScript
Authentication: Auth0
Backend (ProjectZer0Backend)
Framework: NestJS
Language: TypeScript (Node.js)
Database: Neo4j
Current Progress
Frontend
Auth0 Integration: Successfully integrated Auth0 for user authentication.
Routing Logic: Implemented routing to direct users to their dashboard or edit-profile page based on their profile status.
Testing: Set up unit tests with Vitest.
Backend
Database Connection: Successfully connected to Neo4j database.
API Setup: Established basic NestJS application structure.
User Verification Endpoint: Prepared to handle requests to verify user existence.
Next Steps
Connect Frontend and Backend:
Implement API calls from the frontend to the backend to verify user existence.
Ensure the backend properly validates Auth0 tokens and retrieves user information.
Profile Management:
Develop features for users to create and edit their profiles.
Error Handling & Notifications:
Implement user feedback for authentication errors or profile issues.
How to Run the Project
Frontend
Install Dependencies:

bash
Copy code
cd ProjectZer0Frontend
npm install
Run Development Server:

bash
Copy code
npm run dev
Run Tests:

bash
Copy code
npm run test:unit
Backend
Install Dependencies:

bash
Copy code
cd ProjectZer0Backend
npm install
Start the Server:

bash
Copy code
npm run start
Testing and Development
Unit Testing: Currently set up on the frontend using Vitest.
Environment Variables: Ensure you have a .env file set up with the necessary configuration (excluding sensitive information).
Contributing
[Add guidelines if you're open to contributions]

License
[Specify the project's license]