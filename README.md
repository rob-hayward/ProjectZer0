# ProjectZer0

ProjectZer0 is an innovative knowledge-sharing platform that enables collaborative exploration and visualization of interconnected concepts, beliefs, and ideas. The platform uses advanced graph visualization techniques to create an intuitive and interactive user experience.

## 🚀 Project Overview

ProjectZer0 is built on a monorepo architecture with three main components:

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

### Node System & Data Model

The application uses a Neo4j graph database with a sophisticated node architecture:

**Core Node Types:**
- **Word Nodes**: Foundation of the tagging system with self-tagging
- **Category Nodes**: Hierarchical organization (self-categorizing, composed of 1-5 words)
- **Definition Nodes**: Multiple interpretations for words with dual voting
- **Statement Nodes**: User perspectives with keywords and up to 3 categories
- **Open Question Nodes**: Community questions with AI-generated keywords
- **Answer Nodes**: Responses to questions with quality voting
- **Quantity Nodes**: Numerical data with unit conversion and statistical analysis
- **Evidence Nodes**: External sources with 3-dimensional peer review system
- **Discussion/Comment Nodes**: Threaded conversations on any node

**Key Design Patterns:**
- Self-referential relationships (words tag themselves, categories categorize themselves)
- Dual voting system (inclusion + content quality assessment)
- Discovery relationships (SHARED_TAG, SHARED_CATEGORY for content similarity)
- Inheritance-based schema architecture (Base → Tagged → Categorized)
- Peer review and statistical aggregation for specialized nodes

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
- **Database**: Neo4j graph database with sophisticated schema layer
- **Authentication**: JWT with Auth0
- **API**: RESTful endpoints with full TypeScript type safety
- **Schema Architecture**: Inheritance-based with Base, Tagged, and Categorized node classes

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

### Schema Layer
The backend implements a sophisticated inheritance-based schema architecture:

```
BaseNodeSchema (CRUD, voting, validation)
├── TaggedNodeSchema (keyword tagging + discovery)
│   ├── WordSchema (self-tagging)
│   ├── DefinitionSchema
│   └── CategorizedNodeSchema (tagging + categorization)
│       ├── StatementSchema
│       ├── OpenQuestionSchema
│       ├── AnswerSchema
│       ├── QuantitySchema
│       └── EvidenceSchema
└── Special Purpose Schemas
    ├── CategorySchema (self-categorizing, BaseNodeSchema)
    ├── CommentSchema
    └── DiscussionSchema
```

**Relationship Types:**
- Content: DEFINES, ANSWERS, TAGGED, CATEGORIZED_AS, COMPOSED_OF, RELATED_TO
- Discovery: SHARED_TAG, SHARED_CATEGORY (weighted similarity)
- User: CREATED, VOTED_ON, COMMENTED
- Discussion: HAS_DISCUSSION, HAS_COMMENT

## 🧪 Testing

```bash
npm run test
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

- [Schema Layer Documentation](docs/schema-layer.md) - Detailed backend architecture
- [API Documentation](docs/api.md) - REST endpoint reference
- [Graph System Documentation](docs/graph-system.md) - Visualization deep-dive
- [Contributing Guidelines](CONTRIBUTING.md) - How to contribute

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

---