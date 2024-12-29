// src/lib/types/welcome.ts
import type { Vector2, Vector3, Mesh, Line } from 'three';

export interface BackgroundNode {
  position: Vector3;
  velocity: Vector2;
  connections: number[];
  mesh: Mesh;
  color: string;
}

export interface BackgroundEdge {
  source: BackgroundNode;
  target: BackgroundNode;
  line: Line;
}