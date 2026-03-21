"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  Workspace,
  getUserWorkspaces,
  createWorkspace,
  CreateWorkspaceInput,
} from "@/lib/workspace-service";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  setActiveWorkspace: (workspace: Workspace) => void;
  createNewWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspace: null,
  isLoading: true,
  setActiveWorkspace: () => {},
  createNewWorkspace: async () => { throw new Error("Not initialized"); },
  refreshWorkspaces: async () => {},
});

const STORAGE_KEY = "growfy_active_workspace";

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const list = await getUserWorkspaces(user.uid);
      setWorkspaces(list);

      // Restore last active workspace from sessionStorage
      const savedId = sessionStorage.getItem(STORAGE_KEY);
      const saved = list.find((w) => w.id === savedId);
      
      if (saved) {
        setActiveWorkspaceState(saved);
      } else if (list.length === 1) {
        // Auto-select if only one workspace
        setActiveWorkspaceState(list[0]);
        sessionStorage.setItem(STORAGE_KEY, list[0].id);
      }
    } catch (err) {
      console.error("[Workspace] Error loading workspaces:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadWorkspaces();
    }
  }, [authLoading, loadWorkspaces]);

  function setActiveWorkspace(workspace: Workspace) {
    setActiveWorkspaceState(workspace);
    sessionStorage.setItem(STORAGE_KEY, workspace.id);
  }

  async function createNewWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    if (!user) throw new Error("Usuário não autenticado");
    const workspace = await createWorkspace(user.uid, input);
    setWorkspaces((prev) => [...prev, workspace]);
    setActiveWorkspace(workspace);
    return workspace;
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        setActiveWorkspace,
        createNewWorkspace,
        refreshWorkspaces: loadWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useWorkspace() {
  return useContext(WorkspaceContext);
}