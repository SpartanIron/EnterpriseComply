import { pgTable, text, serial, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const graphNodesTable = pgTable("graph_nodes", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  risk: text("risk").notNull().default("none"),
  x: real("x"),
  y: real("y"),
  metadata: jsonb("metadata"),
});

export const insertGraphNodeSchema = createInsertSchema(graphNodesTable).omit({ id: true });
export type InsertGraphNode = z.infer<typeof insertGraphNodeSchema>;
export type GraphNode = typeof graphNodesTable.$inferSelect;

export const graphEdgesTable = pgTable("graph_edges", {
  id: serial("id").primaryKey(),
  edgeId: text("edge_id").notNull().unique(),
  source: text("source").notNull(),
  target: text("target").notNull(),
  type: text("type").notNull(),
  weight: real("weight").notNull().default(1),
});

export const insertGraphEdgeSchema = createInsertSchema(graphEdgesTable).omit({ id: true });
export type InsertGraphEdge = z.infer<typeof insertGraphEdgeSchema>;
export type GraphEdge = typeof graphEdgesTable.$inferSelect;
