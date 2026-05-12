import { create } from 'zustand';

export interface Project {
  id: string;
  name: string;
  client: string;
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  revenue: number;
  expenses: number;
}

interface ProjectsState {
  projects: Project[];
  updateProject: (id: string, updates: Partial<Project>) => void;
  addProject: (project: Omit<Project, 'id'>) => void;
}

const initialProjects: Project[] = [
  { id: 'PRJ-001', name: 'Snoonu Logistics Fleet', client: 'Snoonu', status: 'Active', revenue: 450000, expenses: 320000 },
  { id: 'PRJ-002', name: 'TechCorp Infrastructure', client: 'TechCorp Inc.', status: 'Active', revenue: 120000, expenses: 45000 },
  { id: 'PRJ-003', name: 'City Delivery Expansion', client: 'Urban Eats', status: 'Planning', revenue: 85000, expenses: 12000 },
  { id: 'PRJ-004', name: 'Retail Supply Chain Audit', client: 'MegaMart', status: 'Completed', revenue: 65000, expenses: 22000 },
  { id: 'PRJ-005', name: 'Q3 Rider Contracting', client: 'Snoonu', status: 'Active', revenue: 280000, expenses: 210000 },
  { id: 'PRJ-006', name: 'Warehouse Optimization', client: 'LogisTech', status: 'On Hold', revenue: 95000, expenses: 40000 },
];

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: initialProjects,
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map((p) => p.id === id ? { ...p, ...updates } : p)
  })),
  addProject: (project) => set((state) => {
    const newId = `PRJ-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    return { projects: [...state.projects, { ...project, id: newId }] };
  }),
}));
