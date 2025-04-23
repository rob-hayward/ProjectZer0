# ProjectZer0

ProjectZer0 is an innovative knowledge-sharing platform that enables collaborative exploration and visualization of interconnected concepts, beliefs, and ideas. The platform uses advanced graph visualization techniques to create an intuitive and interactive user experience.

## 🚀 Project Overview

ProjectZer0 is built on a microservice architecture with three main components:

- **Frontend**: A SvelteKit application with advanced D3.js graph visualization
- **Backend**: A NestJS service managing the Neo4j graph database
- **AI Component**: A FastAPI service providing keyword extraction and content analysis

## 🌟 Key Features

### Advanced Graph Visualization
- Dual-layer force simulation for content and navigation
- Dynamic node size transitions with state management
- Smart force-directed and concentric graph layouts
- Context-aware navigation system
- Smooth transitions and custom animations
- Vote-weighted node positioning
- Efficient collision detection and prevention
- Visibility preferences for community and user-controlled content filtering

### Node System
- Word Nodes: Explore definitions and relationships
- Definition Nodes: Multiple interpretations with voting
- Statement Nodes: Share and discuss personal perspectives with keyword extraction
- Navigation Nodes: Context-aware circular menu system
- Discussion Nodes: Threaded conversations linked to any node type

### Interactive Features
- Preview/Detail node state transitions
- Dynamic force scaling based on node states
- Real-time voting and repositioning
- Smooth zoom and pan capabilities
- Intuitive node expansion/collapse
- Content visibility preferences with persistence

### User Experience
- Auth0-powered authentication
- Dynamic user profiles
- Interactive node creation wizards
- Real-time activity tracking
- Responsive layout adaptation

## 🛠 Technology Stack

### Frontend Architecture
- **Core Framework**: SvelteKit with TypeScript
- **Graph System**:
  - D3.js force simulation
  - Custom force calculations
  - SVG-based rendering
  - Three.js for 3D welcome scene
- **State Management**: 
  - Svelte stores
  - Custom node state handling
  - Position caching system
- **Styling**: Dynamic theming with custom animations

### Backend Systems
- **Framework**: NestJS with TypeScript
- **Database**: Neo4j graph database
- **Authentication**: JWT with Auth0
- **API**: RESTful endpoints with TypeScript types

### AI Integration
- **Framework**: FastAPI
- **Models**: KeyBERT with Hugging Face transformers
- **Features**: 
  - Automated keyword extraction
  - Content analysis
  - Asynchronous processing with Redis

## 🚀 Development Setup

### Prerequisites
- Node.js (v16+)
- npm or pnpm
- Neo4j Database
- Python 3.8+ (AI component)
- Redis (optional, for async AI processing)

### Quick Start
```bash
# Frontend
cd ProjectZer0Frontend
npm install
npm run dev

# Backend
cd ProjectZer0Backend
npm install
npm run start:dev

# AI Component
cd ProjectZer0AI
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python3 main.py
```

### Environment Configuration

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
SESSION_SECRET=your-session-secret
```

#### AI Component (.env)
```env
LOG_LEVEL=INFO
API_HOST=0.0.0.0
API_PORT=5000
AI_MODEL_NAME=distilbert-base-nli-mean-tokens
MAX_KEYWORDS=5
KEYWORD_DIVERSITY=0.7
REDIS_HOST=localhost
REDIS_PORT=6379
```

## ⚙️ Technical Architecture

### Graph System

#### Force Configuration
```typescript
// Navigation System
{
  radialForce: {
    strength: 0.8,
    radius: 180
  },
  collisionForce: {
    strength: 1.5,
    padding: 80
  }
}

// Content System
{
  charge: scaledBySize(),
  collision: dynamicPadding(),
  radial: voteWeighted()
}
```

#### Layout Management
- Separate force systems for navigation and content
- Dynamic force scaling based on node states
- Smart collision detection and prevention
- Position caching and smooth transitions
- Vote-weighted positioning for definitions and statements
- Visibility preferences affecting node positioning and display

### Data Model
The application uses a graph data model with Neo4j, where:
- Nodes represent different types of entities (words, definitions, statements)
- Relationships connect nodes (HAS_DEFINITION, CREATED, VOTED_ON)
- Properties store metadata and content
- Specialized schemas handle different node types
- User preferences are stored as visibility settings for nodes

## 🧪 Testing

### Graph System Tests
```bash
# Force calculation tests
npm run test:forces

# Layout tests
npm run test:layout

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance
```

### Component Tests
```bash
# Unit tests
npm run test:unit

# E2E tests
npm run test:e2e
```

## 🔧 Performance Optimization

### Graph Optimization
- Efficient force calculation caching
- Smart node lookup system
- Quadtree-based collision detection
- Position state management
- Transition smoothing

### Resource Management
- Lazy loading for distant nodes
- Memory optimization for large datasets
- Force calculation batching
- State update batching

## 🛡 Security Considerations

- Secure Auth0 integration
- Input sanitization
- XSS prevention
- CSRF protection
- Rate limiting
- Data validation

## 📚 Additional Resources

- [Detailed API Documentation](docs/api.md)
- [Graph System Documentation](docs/graph-system.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Guidelines](SECURITY.md)

## 🤝 Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- D3.js community for force simulation insights
- Neo4j team for graph database expertise
- Auth0 platform for authentication
- SvelteKit and NestJS teams for excellent frameworks
- KeyBERT and Hugging Face for NLP capabilities
- Open source community