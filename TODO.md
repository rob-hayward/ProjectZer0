# ProjectZer0 TODO and Implementation Notes

## Current Sprint

- [x] Database Schema Design:
  - [x] Design Neo4j schema for different node types (beliefs, wants, needs, etc.)
  - [x] Plan the structure for edges, including tag-based connections
  - [x] Design the schema for discussions and voting systems

- [ ] Backend API Development:
  - [ ] Create RESTful endpoints for CRUD operations on nodes:
    - [ ] Implement BeliefNode creation endpoint
    - [ ] Implement WordNode creation/retrieval endpoint
    - [ ] Implement Discussion creation/retrieval endpoint
    - [ ] Implement Comment creation/retrieval endpoint
    - [ ] Implement Voting endpoints (create vote, get tally)
  - [ ] Implement endpoint for fetching graph data with various filters
  - [ ] Create service to handle communication with ProjectZer0AI for tag generation
  - [ ] Implement service to fetch definitions from free dictionary API

- [ ] Integration with ProjectZer0AI:
  - [ ] Set up connection between ProjectZer0Backend and ProjectZer0AI
  - [ ] Implement tag generation flow in the backend

- [ ] Frontend Development:
  - [ ] Add "Create New Node" button to the dashboard
  - [ ] Develop create-node page:
    - [ ] Create dynamic form for node creation
    - [ ] Implement dropdown for node type selection
    - [ ] Add form fields (tags, statement, discussion initiation, creator credit)
    - [ ] Implement client-side form validation
  - [ ] Develop node display components:
    - [ ] Create BeliefNode display component
    - [ ] Create WordNode display component
    - [ ] Implement voting UI for nodes and comments
    - [ ] Create discussion thread component

## Upcoming

- [ ] Complete Create Node Functionality:
  - [ ] Implement full create-node flow with AI tag generation
  - [ ] Add error handling and form validation

- [ ] Graph Visualization:
  - [ ] Set up basic 2D graph using D3.js
  - [ ] Implement node and edge rendering
  - [ ] Add basic interactivity (zooming, panning, clicking nodes)

- [ ] Node Details Page:
  - [ ] Design and implement page to display full node details
  - [ ] Include discussion thread

- [ ] Graph Filters:
  - [ ] Create UI for applying different filters to the graph
  - [ ] Implement filter logic on the frontend

- [ ] Voting System:
  - [ ] Design and implement voting mechanism for nodes and discussions
  - [ ] Update backend to handle vote storage and retrieval

## Backlog

- [ ] Performance Optimization:
  - [ ] Implement efficient graph data loading and rendering
  - [ ] Consider pagination or lazy loading for large graphs

- [ ] Security Enhancements:
  - [ ] Ensure proper authentication and authorization for node creation and editing
  - [ ] Implement measures to prevent spam or abuse in node creation and discussions

- [ ] Advanced Features:
  - [ ] Implement 3D visualization option with Three.js
  - [ ] Develop user notification system for node interactions and discussions

- [ ] User Experience Improvements:
  - [ ] Enhance overall user interface design
  - [ ] Implement mobile responsiveness

- [ ] Documentation:
  - [ ] Update API documentation
  - [ ] Create user guides for new features

## Completed

- [x] Set up initial project structure
- [x] Implement authentication flow
- [x] Create user profile functionality
- [x] Implement user profile editing
- [x] Design and implement database schemas
- [x] Create comprehensive testing suite for schemas

## Implementation Notes

### Project Structure

1. Backend (NestJS):
   - `src/neo4j/`: Neo4j service and schemas
   - `src/nodes/`: Controllers and services for different node types
   - `src/services/`: Additional services (e.g., AI integration, word definition)
   - `src/auth/`: Authentication-related components

2. Frontend (SvelteKit):
   - `src/routes/`: Page components
   - `src/lib/components/`: Reusable UI components
   - `src/lib/services/`: API communication and state management

### Key Relationships and Data Flow

1. BeliefNode:
   - Properties: id, createdBy, publicCredit, statement, initialComment, createdAt, updatedAt
   - Relationships:
     - TAGGED -> WordNode (with frequency property)
     - HAS_DISCUSSION -> DiscussionNode
     - SHARED_TAG -> Other BeliefNodes (with strength property)

2. WordNode:
   - Properties: word, createdBy, createdAt, positiveVotes, negativeVotes
   - Relationships:
     - HAS_DEFINITION -> DefinitionNode
     - HAS_DISCUSSION -> DiscussionNode

3. DefinitionNode:
   - Properties: id, text, createdBy, createdAt, votes

4. DiscussionNode:
   - Properties: id, createdAt
   - Relationships:
     - HAS_COMMENT -> CommentNode

5. CommentNode:
   - Properties: id, createdBy, commentText, createdAt, positiveVotes, negativeVotes

### Node Creation Flow

1. User initiates node creation from the dashboard
2. Frontend displays dynamic form based on node type
3. User fills out form (including manual tags)
4. Frontend sends node data to backend
5. Backend processes the request:
   a. Sends text to ProjectZer0AI for tag generation
   b. Combines AI-generated tags with user-provided tags
   c. Fetches definitions for new words from free dictionary API
   d. Creates necessary nodes and relationships in Neo4j
   e. Returns created node data to frontend
6. Frontend updates display with new node information

### Voting System

- Implement boolean voting (upvote/downvote) for BeliefNodes, WordNodes, and CommentNodes
- Store vote counts directly on nodes for quick access
- Use VOTED_ON relationship between User and voted nodes to prevent duplicate voting

### Edge Strength Calculation

- For SHARED_TAG relationships between BeliefNodes:
  - Strength = product of tag frequencies in both connected beliefs
  - Update strength when beliefs are created or updated

### Testing Strategy

- Unit tests for individual components (services, controllers, schemas)
- Integration tests for API endpoints
- End-to-end tests for critical user flows (e.g., node creation, voting)

### Performance Considerations

- Implement pagination for large result sets
- Use efficient Neo4j queries with appropriate indexes
- Consider caching frequently accessed data

### Security Measures

- Implement proper authentication checks for all sensitive operations
- Validate and sanitize all user inputs
- Use HTTPS for all API communications

## Notes

- Prioritize the implementation of BeliefNode and WordNode creation and display
- Ensure proper error handling and validation in both frontend and backend
- Consider implementing the ProjectZer0AI integration early to facilitate tag generation
- Keep focusing on test-driven development as we implement new features
- Regularly review and update this TODO list as the project progresses