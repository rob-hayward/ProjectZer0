# ProjectZer0

ProjectZer0 is an interactive knowledge-sharing and visualization platform that enables users to explore and contribute to a collective understanding of concepts, beliefs, and their interconnections.

## 🌟 Key Features

### Interactive Graph Visualization
- Dynamic force-directed and concentric graph layouts
- Real-time node interactions and animations
- Custom Three.js-powered welcome scene
- Smooth transitions and zooming capabilities

### Node Types and Interactions
- Word Nodes: Explore definitions and relationships
- Belief Nodes: Share and discuss personal beliefs
- Discussion System: Engage in meaningful conversations
- Voting System: Community-driven content curation

### User Experience
- Seamless Auth0 Authentication
- Customizable user profiles
- Interactive node creation wizards
- Real-time activity tracking
- Responsive design with custom animations

### Technical Features
- SVG and Canvas-based rendering
- WebGL-powered 3D visualizations
- Custom background animations
- Advanced state management
- Optimized performance with virtual scrolling

## 🛠 Technology Stack

### Frontend
- **Framework**: SvelteKit with TypeScript
- **Styling**: Custom CSS with dynamic theming
- **Visualization**: 
  - D3.js for graph layouts
  - Three.js for 3D scenes
  - Custom Canvas animations
- **State Management**: Svelte stores
- **Authentication**: Auth0 integration

### Backend
- **Framework**: NestJS with TypeScript
- **Database**: Neo4j graph database
- **Authentication**: JWT with Auth0
- **API**: RESTful endpoints with TypeScript types

### AI Component
- **Framework**: FastAPI
- **Models**: Integration with Hugging Face transformers
- **Features**: Automated tag generation and content analysis

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or pnpm
- Neo4j Database
- Python 3.8+ (for AI component)

### Frontend Setup
bash
cd ProjectZer0Frontend
npm install
npm run dev

### Backend Setup
```bash
cd ProjectZer0Backend
npm install
npm run start:dev
```

### Environment Variables
Create `.env` files in both frontend and backend directories:

#### Frontend (.env)
```env
AUTH0_DOMAIN=your-auth0-domain
AUTH0_CLIENT_ID=your-client-id
API_BASE_URL=http://localhost:3000
```

#### Backend (.env)
```env
NEO4J_URI=your-neo4j-uri
NEO4J_USERNAME=your-username
NEO4J_PASSWORD=your-password
JWT_SECRET=your-jwt-secret
```

## 🧪 Testing

### Frontend Tests
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### Backend Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

## 📦 Project Structure

### Frontend Structure
```
ProjectZer0Frontend/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── graph/
│   │   │   ├── forms/
│   │   │   └── welcome/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
│   ├── routes/
│   └── app.html
```

### Backend Structure
```
ProjectZer0Backend/
├── src/
│   ├── nodes/
│   ├── users/
│   ├── auth/
│   ├── neo4j/
│   └── main.ts
```

## 📚 API Documentation

### Authentication Endpoints
typescript
POST /auth/login // Authenticate user
POST /auth/refresh-token // Refresh JWT token
GET /auth/profile // Get user profile

### Node Endpoints
```typescript
// Word Nodes
GET    /nodes/word/:id          // Get word node
POST   /nodes/word              // Create word node
PUT    /nodes/word/:id          // Update word node
DELETE /nodes/word/:id          // Delete word node

// Belief Nodes
GET    /nodes/belief/:id        // Get belief node
POST   /nodes/belief            // Create belief node
PUT    /nodes/belief/:id        // Update belief node
DELETE /nodes/belief/:id        // Delete belief node

// Discussion
GET    /discussions/:id         // Get discussion
POST   /discussions            // Create discussion
PUT    /discussions/:id        // Update discussion
DELETE /discussions/:id        // Delete discussion
```

### User Endpoints
```typescript
GET    /users/activity         // Get user activity
PUT    /users/profile         // Update user profile
GET    /users/interactions    // Get user interactions
POST   /users/vote           // Cast vote on node
```

## 🚀 Deployment Guidelines

### Frontend Deployment

1. **Build the Application**
```bash
cd ProjectZer0Frontend
npm run build
```

2. **Environment Configuration**
- Update `.env` with production values
- Configure Auth0 callback URLs
- Set API base URL

3. **Deployment Options**
- Vercel (recommended)
- Netlify
- Custom server

### Backend Deployment

1. **Build the Application**
```bash
cd ProjectZer0Backend
npm run build
```

2. **Environment Setup**
- Configure production environment variables
- Set up Neo4j database connection
- Configure JWT secrets

3. **Deployment Options**
- Docker container
- Cloud services (AWS, GCP, Azure)
- Custom VPS

### AI Component Deployment

1. **Build the FastAPI Application**
```bash
cd ProjectZer0AI
python -m pip install -r requirements.txt
```

2. **Deploy Options**
- Docker container
- Cloud Run
- Kubernetes cluster

## 👥 Contributing Guidelines

### Code Style

1. **TypeScript**
- Use strict type checking
- Follow ESLint configuration
- Use interfaces for complex types

2. **Svelte**
- Follow component structure guidelines
- Use SCSS for styling
- Implement proper reactivity

3. **Testing**
- Write unit tests for utilities
- Include integration tests for components
- Maintain good test coverage

### Git Workflow

1. **Branch Naming**
```
feature/description
bugfix/description
hotfix/description
```

2. **Commit Messages**
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Format code
refactor: Refactor code
test: Add tests
```

3. **Pull Request Process**
- Create feature branch
- Write descriptive PR
- Include tests
- Request review

## ⚙️ Advanced Configuration

### Graph Visualization

1. **Force Layout Configuration**
```typescript
const forceConfig = {
  strength: -800,
  distance: 200,
  center: 0.1,
  collision: 80
}
```

2. **Three.js Scene Settings**
```typescript
const sceneConfig = {
  fov: 75,
  near: 0.1,
  far: 1000,
  position: [0, 0, 100]
}
```

### Performance Optimization

1. **Rendering Options**
- Enable virtual scrolling
- Use WebGL when available
- Implement lazy loading

2. **Caching Strategy**
- Browser cache configuration
- Neo4j query optimization
- State management caching

## 🔧 Troubleshooting Guide

### Common Issues

1. **Authentication Problems**
- Verify Auth0 configuration
- Check JWT token expiration
- Confirm callback URLs

2. **Graph Rendering Issues**
- Check WebGL compatibility
- Verify data structure
- Monitor performance metrics

3. **Database Connection**
- Verify Neo4j credentials
- Check connection string
- Monitor query performance

### Debug Tools

1. **Frontend Debugging**
- Browser DevTools
- Svelte DevTools
- Performance profiler

2. **Backend Logging**
```typescript
logger.debug('Detailed information')
logger.info('General information')
logger.warn('Warning messages')
logger.error('Error details')
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- Three.js community
- D3.js contributors
- Neo4j team
- Auth0 platform
- Open source community
