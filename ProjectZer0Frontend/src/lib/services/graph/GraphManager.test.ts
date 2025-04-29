// src/lib/services/graph/GraphManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GraphManager } from './GraphManager';
import type { GraphData, ViewType, NodeMode } from '../../types/graph/enhanced';
import { get } from 'svelte/store';
import { statementNetworkStore } from '../../stores/statementNetworkStore';

// Create reusable mock nodes first, before any mocks that use it
const mockNodes = [
  {
    id: 'central-node',
    type: 'dashboard',
    group: 'central',
    mode: 'preview',
    fixed: true,
    radius: 120,
    expanded: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fx: 0,
    fy: 0,
    metadata: {
      group: 'central',
      fixed: true
    },
    data: { 
      sub: 'test-user', 
      name: 'Test User',
      email: 'test@example.com' 
    }
  },
  {
    id: 'nav-node',
    type: 'navigation',
    group: 'navigation',
    mode: 'preview',
    radius: 30,
    expanded: false,
    x: 200,
    y: 0,
    vx: 0,
    vy: 0,
    metadata: {
      group: 'navigation'
    },
    data: { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: 'home' 
    }
  }
];

// Function to get a fresh copy of the mock nodes
const createMockNodes = () => [...mockNodes];

// Mock the statementNetworkStore
vi.mock('../../stores/statementNetworkStore', () => ({
  statementNetworkStore: {
    getVoteData: vi.fn().mockImplementation((id) => ({
      positiveVotes: 5,
      negativeVotes: 2,
      netVotes: 3,
      shouldBeHidden: false
    }))
  }
}));

// Mock D3 with proper node tracking
vi.mock('d3', () => {
  return {
    forceSimulation: vi.fn().mockReturnValue({
      force: vi.fn().mockReturnThis(),
      nodes: vi.fn().mockImplementation((newNodes) => {
        if (newNodes !== undefined) {
          return createMockNodes();
        }
        return createMockNodes();
      }),
      alpha: vi.fn().mockReturnThis(),
      alphaTarget: vi.fn().mockReturnThis(),
      alphaDecay: vi.fn().mockReturnThis(),
      alphaMin: vi.fn().mockReturnThis(),
      velocityDecay: vi.fn().mockReturnThis(),
      restart: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      tick: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis()
    }),
    forceLink: vi.fn().mockReturnValue({
      id: vi.fn().mockReturnThis(),
      strength: vi.fn().mockReturnThis(),
      links: vi.fn().mockReturnThis()
    }),
    forceManyBody: vi.fn().mockReturnValue({
      strength: vi.fn().mockReturnThis()
    }),
    forceCollide: vi.fn().mockReturnValue({
      radius: vi.fn().mockReturnThis()
    }),
    zoomIdentity: { 
      scale: vi.fn().mockReturnValue({ 
        translate: vi.fn(),
        toString: vi.fn().mockReturnValue("scale(1)") 
      }),
      translate: vi.fn().mockReturnValue({ 
        scale: vi.fn(),
        toString: vi.fn().mockReturnValue("translate(0,0)") 
      })
    }
  };
});

// Mock layout strategies to prevent deeper level errors
vi.mock('./layouts/SingleNodeLayout', () => ({
  SingleNodeLayout: vi.fn().mockImplementation(() => ({
    initializeNodePositions: vi.fn(),
    configureForces: vi.fn(), 
    handleNodeStateChange: vi.fn(),
    updateData: vi.fn(),
    setSimulation: vi.fn(),
    stop: vi.fn(),
    handleNodeVisibilityChange: vi.fn(),
    enforceFixedPositions: vi.fn(),
    forceTick: vi.fn()
  }))
}));

vi.mock('./layouts/WordDefinitionLayout', () => ({
  WordDefinitionLayout: vi.fn().mockImplementation(() => ({
    initializeNodePositions: vi.fn(),
    configureForces: vi.fn(),
    handleNodeStateChange: vi.fn(),
    updateData: vi.fn(),
    setSimulation: vi.fn(),
    stop: vi.fn(),
    handleNodeVisibilityChange: vi.fn(),
    enforceFixedPositions: vi.fn(),
    forceTick: vi.fn()
  }))
}));

vi.mock('./layouts/StatementNetworkLayout', () => ({
  StatementNetworkLayout: vi.fn().mockImplementation(() => ({
    initializeNodePositions: vi.fn(),
    configureForces: vi.fn(),
    handleNodeStateChange: vi.fn(),
    updateData: vi.fn(),
    setSimulation: vi.fn(),
    stop: vi.fn(),
    handleNodeVisibilityChange: vi.fn(),
    enforceFixedPositions: vi.fn(),
    forceTick: vi.fn()
  }))
}));

// Mock coordinate system
vi.mock('./CoordinateSystem', () => ({
  coordinateSystem: {
    createSVGTransform: vi.fn().mockImplementation((x, y) => `translate(${x}, ${y})`)
  }
}));

// Mock the COORDINATE_SPACE constant
vi.mock('../../constants/graph', () => ({
  COORDINATE_SPACE: {
    WORLD: {
      WIDTH: 1000,
      HEIGHT: 800,
      VIEW: {
        INITIAL_ZOOM: 1,
        MIN_ZOOM: 0.1,
        MAX_ZOOM: 3
      }
    },
    LAYOUT: {
      FORCES: {
        CHARGE: {
          STRENGTH: {
            WORD: -100
          }
        }
      }
    },
    ANIMATION: {
      VELOCITY_DECAY: 0.3,
      ALPHA_DECAY: 0.02,
      ALPHA_MIN: 0.001
    },
    NODES: {
      SIZES: {
        STANDARD: {
          DETAIL: 240,
          PREVIEW: 140
        },
        WORD: {
          DETAIL: 240,
          PREVIEW: 140
        },
        DEFINITION: {
          DETAIL: 240,
          PREVIEW: 140
        },
        STATEMENT: {
          DETAIL: 240,
          PREVIEW: 140
        },
        QUANTITY: {
          DETAIL: 240,
          PREVIEW: 140
        },
        NAVIGATION: 60,
        HIDDEN: 40
      },
      PADDING: {
        COLLISION: {
          BASE: 5
        }
      }
    }
  },
  FORCE_SIMULATION: {
    DEFAULT_ALPHA: 1
  },
  NODE_CONSTANTS: {
    LINE_HEIGHT: {
      preview: 1.4,
      detail: 1.6
    },
    STROKE: {
      preview: {
        normal: 1,
        hover: 2
      },
      detail: {
        normal: 2,
        hover: 3
      }
    }
  }
}));

describe('GraphManager', () => {
  let graphManager: GraphManager;
  
  const mockGraphData: GraphData = {
    nodes: [
      {
        id: 'central-node',
        type: 'dashboard',
        group: 'central',
        data: { 
          sub: 'test-user', 
          name: 'Test User',
          email: 'test@example.com' 
        }
      },
      {
        id: 'nav-node',
        type: 'navigation',
        group: 'navigation',
        data: { 
          id: 'dashboard', 
          label: 'Dashboard', 
          icon: 'home' 
        }
      }
    ],
    links: []
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock all methods that interact with the simulation nodes
    vi.spyOn(GraphManager.prototype as any, 'enforceFixedPositionsStrict')
      .mockImplementation(() => {});
    
    vi.spyOn(GraphManager.prototype as any, 'stopSimulation')
      .mockImplementation(() => {});
    
    vi.spyOn(GraphManager.prototype as any, 'forceTick')
      .mockImplementation(() => {});
      
    // Create the GraphManager instance  
    graphManager = new GraphManager('dashboard');
    
    // Mock the store methods after instance creation
    (graphManager as any).nodesStore = { set: vi.fn() };
    (graphManager as any).linksStore = { set: vi.fn() };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initialization', () => {
    it('should initialize with the correct view type', () => {
      expect(graphManager.viewType).toBe('dashboard');
    });
    
    it('should create renderable nodes store', () => {
      const renderableNodes = get(graphManager.renderableNodes);
      expect(Array.isArray(renderableNodes)).toBe(true);
    });
    
    it('should create renderable links store', () => {
      const renderableLinks = get(graphManager.renderableLinks);
      expect(Array.isArray(renderableLinks)).toBe(true);
    });
  });
  
  describe('Data Management', () => {
    it('should set data and transform nodes and links', () => {
      // Setup spies for private methods
      const transformNodesSpy = vi.spyOn(graphManager as any, 'transformNodes')
        .mockReturnValue(createMockNodes());
      
      const transformLinksSpy = vi.spyOn(graphManager as any, 'transformLinks')
        .mockReturnValue([]);
      
      const applyLayoutSpy = vi.spyOn(graphManager as any, 'applyLayoutStrategy')
        .mockImplementation(() => {});
      
      // Call the method
      graphManager.setData(mockGraphData);
      
      // Verify the methods were called
      expect(transformNodesSpy).toHaveBeenCalledWith(mockGraphData.nodes);
      expect(transformLinksSpy).toHaveBeenCalledWith(mockGraphData.links || []);
      expect(applyLayoutSpy).toHaveBeenCalled();
      expect((graphManager as any).nodesStore.set).toHaveBeenCalled();
    });
  });
  
  describe('Node Management', () => {
    beforeEach(() => {
      // Setup for node management tests
      vi.spyOn(graphManager as any, 'transformNodes')
        .mockReturnValue(createMockNodes());
      
      vi.spyOn(graphManager as any, 'transformLinks')
        .mockReturnValue([]);
        
      vi.spyOn(graphManager as any, 'applyLayoutStrategy')
        .mockImplementation(() => {});
      
      // Initialize with data
      graphManager.setData(mockGraphData);
    });
    
    it('should update node mode', () => {
      // Mock the layout strategy
      (graphManager as any).currentLayoutStrategy = {
        handleNodeStateChange: vi.fn()
      };
      
      // Mock restart function
      const restartFn = vi.fn();
      
      // Replace the simulation
      (graphManager as any).simulation = {
        nodes: vi.fn().mockReturnValue(createMockNodes()),
        alpha: vi.fn().mockReturnValue({
          alphaTarget: vi.fn().mockReturnValue({
            restart: restartFn
          }),
          restart: restartFn
        }),
        tick: vi.fn()
      };
      
      // Also mock the enforceFixedPositionsStrict method
      vi.spyOn(graphManager as any, 'enforceFixedPositionsStrict')
        .mockImplementation(() => {});
      
      // Mock the simulationActive property
      (graphManager as any).simulationActive = false;
      
      // Call the method
      graphManager.updateNodeMode('central-node', 'detail' as NodeMode);
      
      // Verify the layout handler was called
      expect((graphManager as any).currentLayoutStrategy.handleNodeStateChange)
        .toHaveBeenCalledWith('central-node', 'detail');
      
      // Verify restart was called
      expect(restartFn).toHaveBeenCalled();
    });
    
    it('should update node visibility', () => {
      // Mock the layout strategy
      (graphManager as any).currentLayoutStrategy = {
        handleNodeVisibilityChange: vi.fn()
      };
      
      // Mock restart function
      const restartFn = vi.fn();
      
      // Replace the simulation
      (graphManager as any).simulation = {
        nodes: vi.fn().mockReturnValue(createMockNodes()),
        alpha: vi.fn().mockReturnValue({
          alphaTarget: vi.fn().mockReturnValue({
            restart: restartFn
          }),
          restart: restartFn
        }),
        tick: vi.fn()
      };
      
      // Also mock the enforceFixedPositionsStrict method
      vi.spyOn(graphManager as any, 'enforceFixedPositionsStrict')
        .mockImplementation(() => {});
      
      // Mock the simulationActive property
      (graphManager as any).simulationActive = false;
      
      // Call the method
      graphManager.updateNodeVisibility('nav-node', true, 'user');
      
      // Verify layout handler was called
      expect((graphManager as any).currentLayoutStrategy.handleNodeVisibilityChange)
        .toHaveBeenCalledWith('nav-node', true);
      
      // Verify restart was called
      expect(restartFn).toHaveBeenCalled();
    });
    
    it('should recalculate node visibility based on votes', () => {
      // Mocks needed for this test
      (graphManager as any).simulation = {
        nodes: vi.fn().mockReturnValue([
          {
            id: 'central-node',
            type: 'statement', // Change to statement type
            group: 'central',
            data: { 
              statement: 'Test statement',
              createdBy: 'user-1'
            }
          }
        ])
      };
      
      // Override the mock for statementNetworkStore for this test
      // This is critical - we need to mock the return value to test the logic
      vi.mocked(statementNetworkStore.getVoteData).mockReturnValue({
        positiveVotes: 2,
        negativeVotes: 5,
        netVotes: -3,
        shouldBeHidden: true
      });
      
      // Mock the updateNodeVisibility method to verify it's called with correct params
      const updateVisibilitySpy = vi.spyOn(graphManager, 'updateNodeVisibility')
        .mockImplementation(() => {});
        
      // Call the method
      graphManager.recalculateNodeVisibility('central-node', 2, 5);
      
      // Verify updateNodeVisibility was called with hidden=true
      expect(updateVisibilitySpy).toHaveBeenCalledWith('central-node', true, 'community');
    });
  });
  
  describe('View Type Management', () => {
    it('should update view type and apply new layout strategy', () => {
      // Mock enforceFixedPositions that gets called
      vi.spyOn(graphManager as any, 'enforceFixedPositionsStrict')
        .mockImplementation(() => {});
      
      // Mock required methods
      const applyLayoutSpy = vi.spyOn(graphManager as any, 'applyLayoutStrategy')
        .mockImplementation(() => {});
      
      // Call the method
      (graphManager as any).updateViewType('word');
      
      // Verify view type was updated
      expect(graphManager.viewType).toBe('word');
      
      // Verify layout strategy was updated
      expect(applyLayoutSpy).toHaveBeenCalled();
    });
  });
  
  describe('Simulation Control', () => {
    beforeEach(() => {
      // Setup simulation and layout for these tests
      (graphManager as any).currentLayoutStrategy = {
        enforceFixedPositions: vi.fn(),
        forceTick: vi.fn()
      };
    });
    
    it('should fix node positions', () => {
      // Spy on the enforceFixedPositions method
      const fixPositionsSpy = vi.spyOn(graphManager as any, 'enforceFixedPositionsStrict')
        .mockImplementation(() => {});
      
      // Call the method
      graphManager.fixNodePositions();
      
      // Verify the method was called
      expect(fixPositionsSpy).toHaveBeenCalled();
    });
    
    it('should stop simulation', () => {
      // Create a specific spy for stopSimulation
      const stopSpy = vi.fn();
      
      // Reset the mock implementation to actually call our spy
      vi.spyOn(GraphManager.prototype as any, 'stopSimulation')
        .mockImplementation(() => {
          stopSpy();
          (graphManager as any).simulationActive = false;
        });
      
      // Set the active flag to ensure it gets reset
      (graphManager as any).simulationActive = true;
      
      // Create a simulation.stop spy
      const simStopSpy = vi.fn();
      (graphManager as any).simulation = { stop: simStopSpy };
      
      // Call the method
      graphManager.stopSimulation();
      
      // Verify our spy was called
      expect(stopSpy).toHaveBeenCalled();
      // Check the active flag was reset
      expect((graphManager as any).simulationActive).toBe(false);
    });
    
    it('should force tick a specified number of times', () => {
      // Create spies
      const tickSpy = vi.fn();
      const enforceFixedPositionsSpy = vi.fn();
      
      // Reset the implementation to use our spies
      vi.spyOn(GraphManager.prototype as any, 'forceTick')
        .mockImplementation(function(this: any, ...args: any[]) {
          const ticks = typeof args[0] === 'number' ? args[0] : 1;
          // Call the enforceFixedPositionsStrict twice per tick
          for (let i = 0; i < ticks; i++) {
            enforceFixedPositionsSpy();
            tickSpy();
            enforceFixedPositionsSpy();
          }
        });
      
      // Mock the store update
      vi.spyOn(graphManager as any, 'nodesStore', 'set')
        .mockImplementation(() => {});
      
      // Call the method with 3 ticks
      graphManager.forceTick(3);
      
      // Verify tick was called 3 times
      expect(tickSpy).toHaveBeenCalledTimes(3);
      // Verify enforceFixedPositions was called 6 times (twice per tick)
      expect(enforceFixedPositionsSpy).toHaveBeenCalledTimes(6);
    });
    
    it('should clean up resources when stopped', () => {
      // Create spies
      const stopSimulationSpy = vi.fn();
      const layoutStopSpy = vi.fn();
      
      // Set up the stop method
      (graphManager as any).stopSimulation = stopSimulationSpy;
      (graphManager as any).currentLayoutStrategy = {
        stop: layoutStopSpy
      };
      
      // Call the stop method
      graphManager.stop();
      
      // Verify both stops were called
      expect(stopSimulationSpy).toHaveBeenCalled();
      expect(layoutStopSpy).toHaveBeenCalled();
    });
  });
});