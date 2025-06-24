// src/lib/components/welcome/Background.ts
import * as THREE from 'three';
import type { Scene } from 'three';
import type { BackgroundNode, BackgroundEdge } from '$lib/types/welcome';
import { BACKGROUND } from './constants';
// Import the full COLORS constant from the main colors file
import { COLORS as APP_COLORS } from '$lib/constants/colors';

export class Background {
  private nodes: BackgroundNode[] = [];
  private edges: BackgroundEdge[] = [];
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.createBackground();
  }

  private getRandomPrimaryColor(): string {
    const colors = [
      APP_COLORS.PRIMARY.BLUE,
      APP_COLORS.PRIMARY.PURPLE,
      APP_COLORS.PRIMARY.GREEN,
      APP_COLORS.PRIMARY.TURQUOISE,
      APP_COLORS.PRIMARY.ORANGE
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private createBackground() {
    const nodeGeometry = new THREE.SphereGeometry(BACKGROUND.NODE_SIZE, 8, 8);
    const nodeMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: BACKGROUND.NODE_OPACITY
    });

    this.createNodes(nodeGeometry, nodeMaterial);
    this.createEdges();
  }

  private createNodes(geometry: THREE.SphereGeometry, material: THREE.MeshBasicMaterial) {
    for (let i = 0; i < BACKGROUND.NODE_COUNT; i++) {
      const nodeColor = this.getRandomPrimaryColor();
      const nodeMaterial = material.clone();
      nodeMaterial.color = new THREE.Color(nodeColor);

      const node: BackgroundNode = {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * BACKGROUND.FIELD_SIZE,
          (Math.random() - 0.5) * BACKGROUND.FIELD_SIZE,
          BACKGROUND.Z_POSITION + (Math.random() - 0.5) * 20
        ),
        velocity: new THREE.Vector2(
          (Math.random() - 0.5) * BACKGROUND.MOVEMENT.BASE_VELOCITY,
          (Math.random() - 0.5) * BACKGROUND.MOVEMENT.BASE_VELOCITY
        ),
        connections: [],
        mesh: new THREE.Mesh(geometry, nodeMaterial),
        color: nodeColor
      };

      node.mesh.position.copy(node.position);
      this.scene.add(node.mesh);
      this.nodes.push(node);
    }
    console.log(`Created ${this.nodes.length} background nodes`);
  }

  private createEdges() {
    this.nodes.forEach((node, i) => {
      const connectionCount = BACKGROUND.MIN_CONNECTIONS +
        Math.floor(Math.random() * (BACKGROUND.MAX_CONNECTIONS - BACKGROUND.MIN_CONNECTIONS + 1));

      for (let j = 0; j < connectionCount; j++) {
        let targetIndex;
        do {
          targetIndex = Math.floor(Math.random() * BACKGROUND.NODE_COUNT);
        } while (targetIndex === i);

        if (!node.connections.includes(targetIndex)) {
          node.connections.push(targetIndex);
          const targetNode = this.nodes[targetIndex];
          
          // Create line with vertex colors
          const points = [node.position, targetNode.position];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          
          // Set colors for each vertex
          const colors = [];
          colors.push(
            new THREE.Color(node.color).r, 
            new THREE.Color(node.color).g, 
            new THREE.Color(node.color).b
          );
          colors.push(
            new THREE.Color(targetNode.color).r, 
            new THREE.Color(targetNode.color).g, 
            new THREE.Color(targetNode.color).b
          );
          
          geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          
          const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: BACKGROUND.EDGE_OPACITY
          });

          const edge = new THREE.Line(geometry, material);
          this.scene.add(edge);
          
          this.edges.push({
            source: node,
            target: targetNode,
            line: edge
          });
        }
      }
    });
    console.log(`Created ${this.edges.length} background edges`);
  }

  public update() {
    // Update background nodes
    this.nodes.forEach(node => {
      node.velocity.x += (Math.random() - 0.5) * BACKGROUND.MOVEMENT.DRIFT_FORCE;
      node.velocity.y += (Math.random() - 0.5) * BACKGROUND.MOVEMENT.DRIFT_FORCE;

      const speed = node.velocity.length();
      if (speed > BACKGROUND.MOVEMENT.MAX_SPEED) {
        node.velocity.multiplyScalar(BACKGROUND.MOVEMENT.MAX_SPEED / speed);
      }

      node.position.x += node.velocity.x * BACKGROUND.MOVEMENT.VELOCITY_SCALE;
      node.position.y += node.velocity.y * BACKGROUND.MOVEMENT.VELOCITY_SCALE;

      // Wrap around edges
      const limit = BACKGROUND.FIELD_SIZE / 2;
      if (Math.abs(node.position.x) > limit) {
        node.position.x = -Math.sign(node.position.x) * limit;
      }
      if (Math.abs(node.position.y) > limit) {
        node.position.y = -Math.sign(node.position.y) * limit;
      }

      node.mesh.position.copy(node.position);
    });

    // Update edge positions and colors
    this.edges.forEach(edge => {
      const points = [edge.source.position, edge.target.position];
      edge.line.geometry.setFromPoints(points);
      
      // Update vertex colors
      const colors = [];
      colors.push(
        new THREE.Color(edge.source.color).r, 
        new THREE.Color(edge.source.color).g, 
        new THREE.Color(edge.source.color).b
      );
      colors.push(
        new THREE.Color(edge.target.color).r, 
        new THREE.Color(edge.target.color).g, 
        new THREE.Color(edge.target.color).b
      );
      
      edge.line.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      edge.line.geometry.attributes.color.needsUpdate = true;
      
      edge.line.geometry.computeBoundingSphere();
    });
  }

  public dispose() {
    this.nodes.forEach(node => {
      this.scene.remove(node.mesh);
      node.mesh.geometry.dispose();
      (node.mesh.material as THREE.Material).dispose();
    });

    this.edges.forEach(edge => {
      this.scene.remove(edge.line);
      edge.line.geometry.dispose();
      (edge.line.material as THREE.Material).dispose();
    });

    this.nodes = [];
    this.edges = [];
  }
}