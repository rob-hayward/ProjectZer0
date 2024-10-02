# ProjectZer0 TODO

## Current Sprint

- [ ] Database Schema Design:
  - [ ] Design Neo4j schema for different node types (beliefs, wants, needs, etc.)
  - [ ] Plan the structure for edges, including tag-based connections
  - [ ] Design the schema for discussions and voting systems

- [ ] Backend API Development:
  - [ ] Create RESTful endpoints for CRUD operations on nodes
  - [ ] Implement endpoints for fetching graph data with various filters

- [ ] Frontend Development:
  - [ ] Add "Create New Node" button to the dashboard
  - [ ] Develop basic version of create-node page:
    - [ ] Create dynamic form for node creation
    - [ ] Implement dropdown for node type selection
    - [ ] Add basic form fields (statement, discussion initiation)

## Upcoming

- [ ] Integration with ProjectZer0AI:
  - [ ] Set up connection between ProjectZer0Backend and ProjectZer0AI
  - [ ] Create service to handle communication with AI for tag generation

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

## Notes

- Regularly update and run test suite to catch regressions
- Keep documentation up-to-date as new features are added
- Consider user experience and accessibility throughout the development process
- Review and adjust priorities as needed in weekly team meetings