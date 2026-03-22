"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { 
  ArrowLeft, Calendar, User, Tag as TagIcon, Paperclip, 
  CheckSquare, Flag, Clock, History, Loader2, Plus, 
  MessageSquare, Settings, CheckCircle2, Circle, AlertCircle,
  FileText, Image as ImageIcon, Download, Mic, Trash2, Pencil,
  UserPlus, UserMinus, ArrowRightLeft, List, PlusCircle, Folder, IndianRupee
} from "lucide-react";
import TaskPayments from "@/components/TaskPayments";

export default function TaskOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'payments'>('details');

  // Deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Data State
  const [task, setTask] = useState<any>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [agentMap, setAgentMap] = useState<Map<string, any>>(new Map());
  const [tagMap, setTagMap] = useState<Map<string, any>>(new Map());
  const [parentTask, setParentTask] = useState<any>(null);
  const [assignedAgents, setAssignedAgents] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchTaskDetails = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        // Fetch Main Task
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", id)
          .single();

        if (taskError || !taskData) throw new Error("Task not found");
        setTask(taskData);

        // If it's a subtask, fetch parent info
        let pTask = null;
        if (taskData.parent_task_id) {
          const { data: parentData } = await supabase
            .from("tasks")
            .select("id, title")
            .eq("id", taskData.parent_task_id)
            .single();
          pTask = parentData;
        }
        setParentTask(pTask);

        // Parallel Fetch for references
        const [
          { data: allAgents },
          { data: allTags },
          { data: assigns },
          { data: stasks },
          { data: atts },
          { data: acts }
        ] = await Promise.all([
          supabase.from("agents").select("*"),
          supabase.from("tags").select("*"),
          supabase.from("task_assignments").select("*").eq("task_id", id),
          supabase.from("tasks").select("*, task_assignments(agent:agents(*))").eq("parent_task_id", id).order("sort_order", { ascending: true }),
          supabase.from("task_attachments").select("*").eq("task_id", id),
          supabase.from("task_activity").select("*, user:user_id(id, email, name, avatar_url)").eq("task_id", id).order("created_at", { ascending: false })
        ]);

        const aMap = new Map((allAgents || []).map((a: any) => [a.id, a]));
        const tMap = new Map((allTags || []).map((t: any) => [t.id, t]));
        
        setAgentMap(aMap);
        setTagMap(tMap);
        setAssignedAgents((assigns || []).map((a: any) => aMap.get(a.agent_id)).filter(Boolean));
        setSubtasks(stasks || []);
        setAttachments(atts || []);
        setActivities(acts || []);

      } catch (err) {
        console.error("Error fetching task details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskDetails();
  }, [id, supabase]);

  const toggleSubtaskStatus = async (subtaskId: string, currentStatus: string) => {
    const isCompleted = currentStatus === 'completed' || currentStatus === 'done';
    const newStatus = isCompleted ? 'todo' : 'completed';
    
    // Optimistic UI update
    setSubtasks(prev => prev.map(st => st.id === subtaskId ? { ...st, status: newStatus } : st));
    
    // DB Update
    await supabase.from("tasks").update({ status: newStatus }).eq("id", subtaskId);
    
    // Notify main task creator if subtask is completed
    if (newStatus === 'completed' && task.created_by !== currentUser?.id) {
       const subtask = subtasks.find(st => st.id === subtaskId);
       const me = agentMap.get(currentUser?.id);
       const myName = me?.name || currentUser?.email || "Someone";

       await supabase.from("notifications").insert({
        user_id: task.created_by,
        title: 'Subtask Completed',
        message: `Subtask "${subtask?.title}" (part of "${task.title}") has been completed by ${myName}`,
        type: 'task_completed',
        reference_id: id,
        is_read: false
      });
    }

    // Activity Log
    const subtask = subtasks.find(st => st.id === subtaskId);
    await supabase.from("task_activity").insert({
      task_id: id,
      user_id: currentUser?.id,
      action_type: newStatus === 'completed' ? 'subtask_completed' : 'subtask_title_changed',
      action_data: { message: `Subtask "${subtask?.title}" marked as ${newStatus}` }
    });
  };

  const updateMainTaskStatus = async (newStatus: string) => {
    setTask((prev: any) => ({ ...prev, status: newStatus }));
    await supabase.from("tasks").update({ status: newStatus }).eq("id", id);

    // Notify creator if completed
    if (newStatus === 'completed' && task.created_by !== currentUser?.id) {
      const me = agentMap.get(currentUser?.id);
      const myName = me?.name || currentUser?.email || "Someone";

      await supabase.from("notifications").insert({
        user_id: task.created_by,
        title: 'Task Completed',
        message: `Task "${task.title}" has been marked as completed by ${myName}`,
        type: 'task_completed',
        reference_id: id,
        is_read: false
      });
    }

    const { data: newActivity } = await supabase.from("task_activity").insert({
      task_id: id, user_id: currentUser?.id, action_type: newStatus === 'completed' ? 'completed' : 'status_changed', action_data: { new_value: newStatus }
    }).select("*, user:user_id(id, email, name, avatar_url)").single();
    if (newActivity) setActivities(prev => [newActivity, ...prev]);
  };

  const handleDeleteTask = async () => {
    setIsDeleting(true);
    try {
      // Pre-delete dependent records (if missing CASCADE)
      await supabase.from("task_activity").delete().eq("task_id", id);
      await supabase.from("task_attachments").delete().eq("task_id", id);
      await supabase.from("task_assignments").delete().eq("task_id", id);
      
      const { data: stasks } = await supabase.from("tasks").select("id").eq("parent_task_id", id);
      if (stasks && stasks.length > 0) {
        const staskIds = stasks.map(st => st.id);
        await supabase.from("task_activity").delete().in("task_id", staskIds);
        await supabase.from("task_attachments").delete().in("task_id", staskIds);
        await supabase.from("task_assignments").delete().in("task_id", staskIds);
        await supabase.from("tasks").delete().in("id", staskIds);
      }
      
      await supabase.from("tasks").delete().eq("id", id);
      
      router.push("/task-management");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete task: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const { data, error } = await supabase.from('task_activity').insert({
        task_id: id,
        user_id: currentUser?.id,
        action_type: 'commented',
        action_data: { comment_text: newComment.trim() }
      }).select("*, user:user_id(id, email, name, avatar_url)").single();
      
      if (error) throw error;
      setActivities(prev => [data, ...prev]);
      setNewComment("");
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsSubmittingComment(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('task-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
      
      const { data: attachmentData } = await supabase.from('task_attachments').insert({
        task_id: id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document'
      }).select().single();
      
      if (attachmentData) setAttachments((prev: any) => [...prev, attachmentData]);

      const { data: activityData } = await supabase.from('task_activity').insert({
        task_id: id,
        user_id: currentUser?.id,
        action_type: 'attachment_added',
        action_data: { file_name: file.name, file_url: publicUrl, file_type: file.type }
      }).select("*, user:user_id(id, email, name, avatar_url)").single();
      
      if (activityData) setActivities((prev: any) => [activityData, ...prev]);

    } catch (err) {
      console.error("Error uploading file:", err);
    } finally {
      setIsSubmittingComment(false);
      // Reset input value to allow uploading the same file again if needed
      e.target.value = '';
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p?.toLowerCase()) {
      case "low": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "medium": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      case "high": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "urgent": return "text-red-500 bg-red-500/10 border-red-500/20";
      default: return "text-foreground/60 bg-input-bg border-input-border";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'created': return PlusCircle;
      case 'completed': return CheckCircle2;
      case 'reopened': return History;
      case 'commented': return MessageSquare;
      case 'assigned': return UserPlus;
      case 'unassigned': return UserMinus;
      case 'status_changed': return ArrowRightLeft;
      case 'priority_changed': return Flag;
      case 'deadline_changed': return Calendar;
      case 'title_changed': return Pencil;
      case 'description_changed': return FileText;
      case 'project_changed': return Folder;
      case 'attachment_added': return Paperclip;
      case 'attachment_removed': return Trash2;
      case 'subtask_added': return List;
      case 'subtask_completed': return CheckSquare;
      case 'tags_changed': return TagIcon;
      default: return Pencil;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'created':
      case 'completed':
      case 'attachment_added':
      case 'subtask_added':
      case 'subtask_completed':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'priority_changed':
      case 'attachment_removed':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'commented':
      case 'assigned':
      case 'title_changed':
      case 'description_changed':
      case 'project_changed':
      case 'subtask_title_changed':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'status_changed':
      case 'reopened': 
      case 'deadline_changed':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'tags_changed':
        return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      default:
        return 'text-foreground/50 bg-input-bg border-input-border';
    }
  };

  const getActivityRingColor = (type: string) => {
    switch (type) {
      case 'created':
      case 'completed':
      case 'attachment_added':
      case 'subtask_added':
      case 'subtask_completed': return 'ring-green-500/20';
      case 'priority_changed':
      case 'attachment_removed': return 'ring-red-500/20';
      case 'commented':
      case 'assigned':
      case 'title_changed':
      case 'description_changed':
      case 'project_changed':
      case 'subtask_title_changed': return 'ring-orange-500/20';
      case 'status_changed':
      case 'reopened': 
      case 'deadline_changed': return 'ring-yellow-500/20';
      case 'tags_changed': return 'ring-purple-500/20';
      default: return 'ring-foreground/5';
    }
  };

  const getActivityMessage = (act: any) => {
    const userName = act.user?.name || act.user?.email?.split('@')[0] || act.user_id?.substring(0,8) || 'Someone';
    const data = act.action_data || {};
    
    switch (act.action_type) {
        case 'created': return `${userName} created this task`;
        case 'completed': return `${userName} marked task as complete`;
        case 'reopened': return `${userName} reopened this task`;
        case 'commented': return `${userName} commented`;
        case 'assigned': return `${userName} assigned a user`;
        case 'unassigned': return `${userName} unassigned a user`;
        case 'status_changed': return `${userName} changed status to ${data.new_value || 'Unknown'}`;
        case 'priority_changed': return `${userName} changed priority to ${data.new_value || 'Unknown'}`;
        case 'deadline_changed': return `${userName} changed the deadline`;
        case 'attachment_added': return `${userName} attached a file`;
        case 'attachment_removed': return `${userName} removed an attachment`;
        case 'subtask_added': return `${userName} added a subtask`;
        case 'subtask_completed': return `${userName} completed a subtask`;
        case 'tags_changed': return `${userName} updated tags`;
        default: return data.message || `${userName} updated this task`;
    }
  };

  const getActivityDetails = (act: any) => {
    const data = act.action_data || {};
    switch (act.action_type) {
      case 'commented':
        return data.comment_text ? <p className="text-sm italic text-foreground/70">"{data.comment_text}"</p> : null;
      case 'title_changed':
      case 'category_changed':
      case 'area_changed':
      case 'focus_changed':
      case 'reminder_changed':
        return <p className="text-xs text-foreground/60 font-medium">{data.old_value || 'None'} <ArrowRightLeft className="w-3 h-3 inline mx-1 opacity-50"/> {data.new_value || 'None'}</p>;
      case 'description_changed':
      case 'subtask_title_changed':
        return (
          <div className="flex flex-col gap-1">
             <p className="text-xs text-red-500/70 line-through line-clamp-2">{data.old_value || 'Empty'}</p>
             <p className="text-xs text-green-500/70 line-clamp-2">{data.new_value || 'Empty'}</p>
          </div>
        );
      case 'deadline_changed':
        if (data.old_value && data.new_value) {
            return <p className="text-xs text-foreground/60 font-mono">
              {new Date(data.old_value).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric'})} 
              <ArrowRightLeft className="w-3 h-3 inline mx-2 opacity-50"/> 
              {new Date(data.new_value).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric'})}
            </p>;
        }
        return null;
      case 'tags_changed':
        const oldTags = Array.isArray(data.old_value) ? data.old_value : [];
        const newTags = Array.isArray(data.new_value) ? data.new_value : [];
        const added = newTags.filter((t: any) => !oldTags.includes(t));
        const rem = oldTags.filter((t: any) => !newTags.includes(t));
        return (
          <div className="flex flex-wrap gap-2">
            {rem.map((t: string) => <span key={`r-${t}`} className="text-[10px] uppercase font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 line-through">#{t}</span>)}
            {added.map((t: string) => <span key={`a-${t}`} className="text-[10px] uppercase font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">#{t}</span>)}
          </div>
        );
      case 'attachment_added':
      case 'attachment_removed':
        return data.file_name ? <p className="text-xs text-foreground/60 font-medium flex items-center gap-1.5"><Paperclip className="w-3 h-3"/> {data.file_name}</p> : null;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-foreground/50 font-medium">Loading task details...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Task Not Found</h2>
        <button onClick={() => router.push('/task-management')} className="mt-6 px-6 py-2.5 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  const creator = agentMap.get(task.created_by);
  const taskTags = (task.tags || []).map((tid: string) => tagMap.get(tid)).filter(Boolean);
  
  const isDone = task.status === 'completed' || task.status === 'done';
  const progress = subtasks.length > 0 
    ? Math.round((subtasks.filter(st => st.status === 'completed' || st.status === 'done').length / subtasks.length) * 100) 
    : isDone ? 100 : 0;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 fade-in slide-in-from-bottom-4 duration-500 animate-in">
      
      {/* Top Navigation */}
      <div className="mb-8 flex items-center justify-between">
        <button onClick={() => router.push('/task-management')} className="flex items-center text-sm font-bold text-foreground/60 hover:text-foreground transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Tasks
        </button>
        
        <div className="flex items-center gap-3">
          {currentUser?.id === task.created_by && (
            <>
              <button onClick={() => router.push(`/task-management/edit-task/${id}`)} className="p-2 text-foreground/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-foreground/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button 
            onClick={() => updateMainTaskStatus(isDone ? 'todo' : 'completed')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center ${isDone ? 'bg-input-bg text-foreground/60 border border-input-border hover:bg-input-border' : 'bg-primary text-white hover:bg-primary-hover shadow-primary/20 hover:shadow-[0_0_20px_rgba(226,70,129,0.4)]'}`}
          >
            {isDone ? <History className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {isDone ? 'Reopen Task' : 'Mark Complete'}
          </button>
        </div>
      </div>

      
      {/* Header Card (Always Visible) */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-primary/5 shadow-xl shadow-primary/5 relative overflow-hidden mb-8">
        {/* Background Status Indicator */}
        {isDone && <div className="absolute -right-8 -top-8 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />}

        {/* Subtask Context */}
        {parentTask && (
          <Link href={`/task-management/task/${parentTask.id}`} className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-primary text-[11px] font-bold hover:bg-primary/10 transition-colors group/parent w-fit">
             <ArrowRightLeft className="w-3.5 h-3.5 opacity-60 group-hover/parent:rotate-180 transition-transform duration-500" />
             <span>Subtask of: <span className="underline decoration-primary/30">{parentTask.title}</span></span>
          </Link>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-4">
           <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${isDone ? 'text-green-500 bg-green-500/10 border-green-500/20' : task.status === 'in_progress' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' : 'text-slate-500 bg-slate-500/10 border-slate-500/20'}`}>
            {isDone ? 'Completed' : task.status === 'in_progress' ? 'In Progress' : task.status === 'todo' ? 'To Do' : task.status?.replace('_', ' ') || 'To Do'}
          </span>
          <span className={`flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${getPriorityColor(task.priority)}`}>
            <Flag className="w-3 h-3 mr-1" />
            {task.priority || 'Medium'}
          </span>
        </div>
        
        <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 ${isDone ? 'text-foreground/50 line-through decoration-primary/30' : 'text-foreground'}`}>
          {task.title}
        </h1>
        
        {task.description && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 mt-6 leading-relaxed bg-card-bg/30 p-5 rounded-2xl border border-card-border/50">
            {task.description.split('\n').map((para: string, idx: number) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 lg:gap-6 mb-8 border-b border-card-border pb-px overflow-x-auto custom-scrollbar">
        <button 
          onClick={() => setActiveTab('details')}
          className={`px-4 lg:px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-foreground/50 hover:text-foreground hover:border-card-border'}`}
        >
          <FileText className="w-4 h-4 mr-2" /> Details
        </button>
        <button 
          onClick={() => setActiveTab('activity')}
          className={`px-4 lg:px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center ${activeTab === 'activity' ? 'border-primary text-primary' : 'border-transparent text-foreground/50 hover:text-foreground hover:border-card-border'}`}
        >
          <History className="w-4 h-4 mr-2" /> Activity
          {activities.length > 0 && <span className="ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px]">{activities.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('payments')}
          className={`px-4 lg:px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center ${activeTab === 'payments' ? 'border-primary text-primary' : 'border-transparent text-foreground/50 hover:text-foreground hover:border-card-border'}`}
        >
          <IndianRupee className="w-4 h-4 mr-2" /> Payments
        </button>
      </div>

      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Subtasks Section */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 border border-card-border overflow-hidden relative">
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-lg font-bold text-foreground flex items-center">
                  <CheckSquare className="w-5 h-5 mr-2 text-primary" />
                  Subtasks & Checklist
                </h3>
                {subtasks.length > 0 && (
                  <div className="text-xs font-bold text-foreground/50 bg-input-bg px-3 py-1 rounded-full border border-input-border">
                    {progress}% Done
                  </div>
                )}
              </div>
              
              {subtasks.length > 0 ? (
                <>
                  {/* Progress Bar */}
              <div className="w-full h-1.5 bg-input-bg rounded-full mb-6 overflow-hidden relative z-10">
                <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
              </div>

              <div className="space-y-3 relative z-10">
                {subtasks.map((st) => {
                  const isSubDone = st.status === 'completed' || st.status === 'done';
                  const stAssignees = st.task_assignments?.map((ta: any) => ta.agent).filter(Boolean) || [];

                  return (
                    <div key={st.id} 
                      onClick={() => toggleSubtaskStatus(st.id, st.status)}
                      className={`group min-h-14 flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${isSubDone ? 'bg-input-bg/50 border-input-border/50' : 'bg-card-bg border-card-border hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSubDone ? 'bg-primary border-primary' : 'border-primary/40 group-hover:border-primary'}`}>
                        {isSubDone && <CheckSquare className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                        <span className={`text-sm font-medium transition-all truncate ${isSubDone ? 'text-foreground/40 line-through' : 'text-foreground'}`}>
                          {st.title}
                        </span>
                        
                        <div className="flex items-center gap-4 shrink-0">
                          {stAssignees.length > 0 && (
                            <div className="flex -space-x-1.5 opacity-80">
                              {stAssignees.slice(0, 3).map((agent: any, i: number) => (
                                <div key={agent.id} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card-bg flex items-center justify-center text-[10px] font-bold text-primary" style={{ zIndex: 10 - i }}>
                                  {agent.name ? agent.name.substring(0,1).toUpperCase() : '?'}
                                </div>
                              ))}
                            </div>
                          )}

                          {st.deadline && (
                            <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center ${!isSubDone && new Date(st.deadline) < new Date() ? 'text-red-500' : 'text-foreground/40'}`}>
                              <Calendar className="w-3 h-3 mr-1" />
                              {new Date(st.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              ) : (
                <div className="text-center py-12 opacity-80 bg-input-bg/30 relative z-10 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-card-bg border border-card-border rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <CheckSquare className="w-8 h-8 text-primary/40" />
                  </div>
                  <h4 className="text-foreground font-bold mb-1">No Subtasks Found</h4>
                  <p className="text-xs text-foreground/50 font-medium max-w-[200px]">This task doesn't have any subtasks or checklist items yet.</p>
                </div>
              )}
            </div>
            {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="glass-card rounded-3xl p-6 sm:p-8 border border-card-border">
              <h3 className="text-lg font-bold text-foreground flex items-center mb-6">
                <Paperclip className="w-5 h-5 mr-2 text-primary" />
                Attachments ({attachments.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {attachments.map((att) => (
                  <a key={att.id} href={att.file_url} target="_blank" rel="noreferrer" className="group rounded-xl border border-input-border bg-input-bg overflow-hidden flex flex-col hover:border-primary/50 transition-colors">
                    <div className="h-24 bg-card-bg flex items-center justify-center relative">
                      {att.file_type === 'image' ? (
                        <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : att.file_type === 'audio' ? (
                        <Mic className="w-8 h-8 text-primary/50 group-hover:text-primary transition-colors" />
                      ) : (
                        <FileText className="w-8 h-8 text-foreground/30 group-hover:text-primary transition-colors" />
                      )}
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <Download className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold text-foreground truncate">{att.file_name}</p>
                      <p className="text-[10px] text-foreground/50 uppercase tracking-wider mt-1">{att.file_type}</p>
                    </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Details Card */}
          <div className="glass-card rounded-3xl p-6 border border-card-border relative overflow-hidden">
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/40 mb-6 flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Task Details
            </h3>

            <div className="space-y-6 relative z-10">
               {/* Assignees */}
               <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2 block">Assigned To</label>
                {assignedAgents.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {assignedAgents.map((agent: any) => (
                      <div key={agent?.id} className="flex items-center gap-2 bg-input-bg border border-input-border px-3 py-1.5 rounded-lg">
                        <div className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                          <User className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-xs font-bold text-foreground">{agent?.name || 'Unknown'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs font-medium text-foreground/40 italic">Unassigned</span>
                )}
              </div>

              {/* Creator */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2 block">Created By</label>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-card-bg border border-card-border rounded-full flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-foreground/60" />
                  </div>
                  <span className="text-xs font-bold text-foreground">{creator?.name || 'You'}</span>
                </div>
              </div>

              <div className="w-full h-px bg-card-border" />

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-1.5 block">Deadline</label>
                  <div className={`text-xs font-bold flex items-center ${task.deadline && new Date(task.deadline) < new Date() && !isDone ? 'text-red-500' : 'text-foreground'}`}>
                    <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                    {task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No deadline'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-1.5 block">Created</label>
                  <div className="text-xs font-bold text-foreground flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                    {new Date(task.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
      )}

      {activeTab === 'activity' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-8">
            {/* Comments Section */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 border border-card-border overflow-hidden ">
              <h3 className="text-lg font-bold text-foreground flex items-center mb-6">
                <MessageSquare className="w-5 h-5 mr-2 text-primary" />
                Comments
              </h3>
              
              <div className="space-y-6">
                {activities.filter(a => a.action_type === 'commented' || a.action_type === 'attachment_added').length > 0 ? (
                  activities.filter(a => a.action_type === 'commented' || a.action_type === 'attachment_added').reverse().map(comment => {
                    const isCurrentUser = comment.user_id === currentUser?.id;
                    const isComment = comment.action_type === 'commented';
                    return (
                    <div key={comment.id} className={`flex gap-4 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold shadow-inner ${isCurrentUser ? 'bg-primary text-white' : 'bg-primary/20 text-primary'}`}>
                         {comment.user?.name ? comment.user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className={`flex-1 border ${isCurrentUser ? 'bg-primary/5 border-primary/20 rounded-2xl rounded-tr-none' : 'bg-input-bg border-input-border rounded-2xl rounded-tl-none'} p-5 shadow-sm hover:border-primary/30 transition-colors`}>
                        <div className={`flex items-center justify-between gap-4 mb-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[15px] font-bold text-foreground">{isCurrentUser ? 'You' : (comment.user?.name || 'Unknown User')}</span>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-foreground/50 flex items-center">
                            {new Date(comment.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(' at', ',').toUpperCase()}
                          </span>
                        </div>
                        {isComment ? (
                          <p className={`text-sm leading-relaxed font-medium ${isCurrentUser ? 'text-right text-foreground/90' : 'text-left text-foreground/80'}`}>
                            {comment.action_data?.comment_text}
                          </p>
                        ) : (
                          <div className={`flex items-center gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                            <div className="w-12 h-12 bg-card-bg rounded-lg border border-card-border flex items-center justify-center shrink-0">
                               {comment.action_data?.file_type?.startsWith('image/') ? <ImageIcon className="w-5 h-5 opacity-60" /> : <Paperclip className="w-5 h-5 opacity-60" />}
                            </div>
                            <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                              <a href={comment.action_data?.file_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary hover:underline">{comment.action_data?.file_name || 'Attached File'}</a>
                              <span className="text-[10px] uppercase font-bold text-foreground/40 mt-1 truncate max-w-[150px]">{comment.action_data?.file_type || 'Document'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )})
                ) : (
                  <div className="text-center p-8 border-2 border-dashed border-input-border rounded-2xl opacity-60 bg-input-bg/30">
                     <MessageSquare className="w-8 h-8 opacity-40 mx-auto mb-3" />
                     <p className="text-sm font-bold text-foreground/50">No comments yet. Start the conversation!</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-card-border flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-primary font-bold">
                  {currentUser?.user_metadata?.name ? currentUser.user_metadata.name.charAt(0).toUpperCase() : 'Y'}
                </div>
                <div className="flex-1">
                  <textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a status update or comment..." 
                    className="w-full bg-input-bg border border-input-border rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm min-h-[120px] resize-y custom-scrollbar"
                  />
                  <div className="mt-4 flex justify-between items-center">
                    <div className="flex items-center">
                      <input type="file" id="comment-file" className="hidden" onChange={handleFileUpload} />
                      <label htmlFor="comment-file" className={`p-2.5 rounded-xl border border-input-border bg-input-bg/50 hover:bg-input-bg hover:border-primary/40 transition cursor-pointer flex items-center gap-2 ${isSubmittingComment ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Paperclip className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-bold text-foreground/70">Attach File</span>
                      </label>
                    </div>
                    <button 
                      disabled={!newComment.trim() || isSubmittingComment}
                      onClick={handleAddComment}
                      className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95"
                    >
                      {isSubmittingComment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-8">
            {/* Activity Feed */}
          <div className="glass-card rounded-3xl p-6 border border-card-border">
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/40 mb-6 flex items-center">
              <History className="w-4 h-4 mr-2" />
              Activity Log
            </h3>

            {activities.length > 0 ? (
              <div className="space-y-6 relative pt-2 pb-2">
                {activities.map((act, index) => {
                  const isViewed = act.action_type === 'viewed';
                  if (isViewed) return null;

                  const Icon = getActivityIcon(act.action_type);
                  const colorClass = getActivityColor(act.action_type);
                  const ringClass = getActivityRingColor(act.action_type);
                  const details = getActivityDetails(act);
                  const isLast = index === activities.length - 1;

                  return (
                    <div key={act.id} className="relative flex items-start gap-5">
                      {/* Timeline Line connected strictly between items */}
                      {!isLast && (
                        <div className="absolute top-10 left-[15px] bottom-[-32px] w-[2px] bg-card-border/60 z-0" />
                      )}

                      <div className={`w-8 h-8 rounded-full border shadow-sm flex items-center justify-center shrink-0 z-10 bg-card-bg ring-4 ring-offset-0 ${colorClass} ${ringClass} mt-1`}>
                        <Icon strokeWidth={2.5} className="w-4 h-4" />
                      </div>
                      <div className="flex-1 bg-card-bg border border-input-border rounded-2xl p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
                          <p className="text-[15px] text-foreground font-bold group-hover:text-primary transition-colors leading-snug">
                            {getActivityMessage(act)}
                          </p>
                          <span className="text-[10px] font-extrabold text-foreground/50 uppercase tracking-widest shrink-0 flex items-center gap-1.5 bg-input-bg/50 px-3 py-1.5 rounded-lg border border-input-border">
                            <Clock className="w-3.5 h-3.5 opacity-60" />
                            {new Date(act.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(' at', ',').toUpperCase()}
                          </span>
                        </div>
                        {details && (
                          <div className="mt-3 bg-card-bg p-3.5 rounded-xl border border-input-border/50 text-[14px]">
                            {details}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-foreground/40 italic">No activity recorded yet.</p>
            )}
          </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TaskPayments taskId={id} />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card-bg border border-card-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-red-500/10 relative z-10">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Delete this task?</h3>
            <p className="text-sm font-medium text-foreground/60 mb-8 leading-relaxed">
              Are you sure you want to delete <span className="text-foreground font-bold">"{task.title}"</span>? This action cannot be undone and will remove all associated subtasks, attachments, and activity logs.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-foreground/70 hover:bg-input-bg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 flex items-center"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {isDeleting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
