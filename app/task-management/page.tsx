"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Plus,
  Clock,
  AlertCircle,
  ChevronRight,
  Search,
  Loader2,
  LayoutGrid,
  List as ListIcon,
  CheckSquare,
  ArrowUpRight,
  Kanban,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";

export default function TaskManagementDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [assignedTaskIds, setAssignedTaskIds] = useState<string[]>([]);

  // View State
  const [activeTab, setActiveTab] = useState<"assigned" | "created">(
    "assigned",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">(
    "kanban",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
    try {
      await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setCurrentUser(user);

        // 1. Get task IDs assigned to the current user
        const { data: assignments } = await supabase
          .from("task_assignments")
          .select("task_id")
          .eq("agent_id", user.id);

        const assignedIds = assignments?.map((a) => a.task_id) || [];
        setAssignedTaskIds(assignedIds);

        // 2. Fetch all tasks where user is assigned OR user created it
        const orConditions = [`created_by.eq.${user.id}`];
        if (assignedIds.length > 0) {
          orConditions.push(`id.in.(${assignedIds.join(",")})`);
        }

        const { data: allTasks, error: tasksError } = await supabase
          .from("tasks")
          .select("*, task_attachments(*), task_assignments(agent:agents(*))")
          .or(orConditions.join(","))
          .order("created_at", { ascending: false });

        if (tasksError) throw tasksError;
        setTasks(allTasks || []);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router, supabase]);

  // Derived state
  const displayedTasks = tasks.filter((task) => {
    // 1. Filter by Tab
    if (activeTab === "assigned" && !assignedTaskIds.includes(task.id))
      return false;
    if (activeTab === "created" && task.created_by !== currentUser?.id)
      return false;

    // 2. Filter by Search
    if (
      searchQuery &&
      !task.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;

    return true;
  });

  const getPriorityInfo = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return {
          color: "text-red-500 bg-red-500/10 border-red-500/20",
          icon: AlertCircle,
          label: "Urgent",
        };
      case "high":
        return {
          color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
          icon: ArrowUpRight,
          label: "High",
        };
      case "medium":
        return {
          color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
          icon: Clock,
          label: "Medium",
        };
      case "low":
        return {
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
          icon: ChevronRight,
          label: "Low",
        };
      default:
        return {
          color: "text-foreground/60 bg-input-bg border-input-border",
          icon: AlertCircle,
          label: priority || "Unknown",
        };
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status?.toLowerCase()) {
      case "todo":
        return {
          color: "text-slate-500 border-slate-500/20 bg-slate-500/10",
          label: "To Do",
        };
      case "in_progress":
        return {
          color: "text-blue-500 border-blue-500/20 bg-blue-500/10",
          label: "In Progress",
        };
      case "done":
      case "completed":
        return {
          color: "text-green-500 border-green-500/20 bg-green-500/10",
          label: "Completed",
        };
      default:
        return {
          color: "text-foreground/60 border-input-border bg-input-bg",
          label: status || "Unknown",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden fade-in animate-in relative">
      {/* Header Section */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-6 bg-card-bg/50 border-b border-card-border backdrop-blur-md z-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight flex items-center">
              <CheckSquare className="mr-3 text-primary size-6 md:size-8" />
              My Tasks
            </h1>
            <p className="text-foreground/60 mt-2 text-sm max-w-xl">
              Manage, track, and organize all your assigned and created tasks in
              one place.
            </p>
          </div>
          <Link
            href="/task-management/new-task"
            className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-[0_0_20px_rgba(226,70,129,0.3)] hover:shadow-[0_0_30px_rgba(226,70,129,0.5)] transition-all group shrink-0"
          >
            <Plus className="w-5 h-5 mr-2 group-hover:scale-125 transition-transform" />
            Create New Task
          </Link>
        </div>

        {/* Controls & Filters */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mt-4 max-w-7xl mx-auto">
          {/* Tabs */}
          <div className="flex bg-input-bg p-1 rounded-xl shadow-inner w-full lg:w-auto">
            <button
              onClick={() => setActiveTab("assigned")}
              className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "assigned" ? "bg-card-bg text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => setActiveTab("created")}
              className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "created" ? "bg-card-bg text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
            >
              Created by Me
            </button>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-input-bg border border-input-border rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground"
              />
            </div>

            {/* View Toggles */}
            <div className="flex bg-input-bg p-1 rounded-xl shadow-inner shrink-0 items-center">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-card-bg text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-card-bg text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-2 rounded-lg transition-all ${viewMode === "kanban" ? "bg-card-bg text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
              >
                <Kanban className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Display — flex-1 relative so children can use absolute inset-0 */}
      {displayedTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center p-20 text-center glass-card rounded-3xl border border-dashed border-input-border w-full max-w-2xl">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <CheckSquare className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              No tasks found
            </h3>
            <p className="text-foreground/50 text-sm max-w-sm mb-8">
              {searchQuery
                ? "We couldn't find any tasks matching your search."
                : activeTab === "assigned"
                  ? "You don't have any tasks assigned to you right now. You're all caught up!"
                  : "You haven't created any tasks yet."}
            </p>
            {!searchQuery && activeTab === "created" && (
              <Link
                href="/task-management/new-task"
                className="px-6 py-2.5 bg-card-bg border border-card-border hover:border-primary/50 rounded-xl text-sm font-bold transition-colors"
              >
                Create your first task
              </Link>
            )}
          </div>
        </div>
      ) : viewMode === "kanban" ? (
        // Kanban: board/page.tsx pattern — flex-1 relative + absolute inset-0 overflow-x-auto
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar p-6">
            <div className="flex h-full w-max gap-6 items-stretch">
              {["todo", "in_progress", "completed"].map((statusId) => {
                const colTasks = displayedTasks.filter(
                  (t) =>
                    t.status?.toLowerCase() === statusId ||
                    (!t.status && statusId === "todo") ||
                    (t.status?.toLowerCase() === "done" &&
                      statusId === "completed"),
                );
                const statusInfo = getStatusInfo(statusId);

                const dotColor = statusInfo.color.includes("slate")
                  ? "bg-slate-500"
                  : statusInfo.color.includes("blue")
                    ? "bg-blue-500"
                    : "bg-green-500";

                return (
                  <div
                    key={statusId}
                    className={`w-[320px] shrink-0 flex flex-col h-full bg-input-bg/30 rounded-3xl border transition-colors ${draggedTaskId ? "border-primary/30 border-dashed bg-card-bg/20" : "border-card-border/50"}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTaskId) {
                        handleUpdateTaskStatus(draggedTaskId, statusId);
                        setDraggedTaskId(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between p-5 pb-3 shrink-0">
                      <h3 className="font-extrabold text-foreground flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 shadow-sm ${dotColor}`}></div>
                        {statusInfo.label}
                      </h3>
                      <span className="text-xs font-bold bg-card-bg px-2.5 py-1 rounded-md text-foreground/70 shadow-sm border border-card-border/50">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="flex-1 relative min-h-0">
                      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar-sm flex flex-col gap-3 p-4">
                        {colTasks.length === 0 ? (
                          <div className="flex-1 min-h-[150px] flex flex-col items-center justify-center border-2 border-dashed border-card-border/60 rounded-2xl opacity-60 m-1">
                            <Inbox className="w-8 h-8 mb-2 text-foreground/40" />
                            <span className="text-sm font-bold text-foreground/40">
                              Drop tasks here
                            </span>
                          </div>
                        ) : (
                          colTasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedTaskId(task.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", task.id);
                              }}
                              onDragEnd={() => setDraggedTaskId(null)}
                              className={`cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform ${draggedTaskId === task.id ? "opacity-30" : ""}`}
                            >
                              <TaskCard task={task} viewMode="board" />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Grid / List: scrollable area using same absolute inset-0 pattern
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-6">
            <div
              className={`w-full max-w-7xl mx-auto ${
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch"
                  : "flex flex-col gap-4"
              }`}
            >
              {displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  viewMode={viewMode as "grid" | "list"}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
