"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Calendar, User, AlignLeft, Target, Loader2, Plus, Flag, FolderPlus,
  ArrowLeft, Paperclip, Mic, Square, Trash2, Bell, Repeat, Tag as TagIcon,
  Image as ImageIcon, CheckSquare, X, ChevronDown, ChevronRight
} from "lucide-react";

type Attachment = { file: File; type: string; previewUrl: string; mimeType: string };

type Subtask = {
  id: string;
  title: string;
  assigneeIds: string[];
  deadlineDate: string;
  deadlineTime: string;
  reminder: string;
  repeat: string;
  tags: string[];
  attachments: Attachment[];
  showDetails: boolean;
  showAssigneeDropdown: boolean;
};

export default function NewTaskPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  // Data
  const [agents, setAgents] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- FORM STATE ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [projectId, setProjectId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  // Date & Time
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [reminder, setReminder] = useState("");
  const [repeat, setRepeat] = useState("");

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  // Attachments (Main Task & Goal)
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const goalFileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [goalAttachments, setGoalAttachments] = useState<Attachment[]>([]);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  // Audio Recording (Shared)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<string | null>(null);
  const recordingTargetRef = useRef<string | null>(null);

  // --- INITIAL LOAD ---
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const [{ data: agData }, { data: prData }, { data: tgData }] = await Promise.all([
        supabase.from("agents").select("id, name, email").order("name"),
        supabase.from("projects").select("id, name").eq("status", "active").order("name"),
        supabase.from("tags").select("*").order("name")
      ]);

      if (agData) setAgents(agData);
      if (prData) setProjects(prData);
      if (tgData) setAvailableTags(tgData);

      setFetchingData(false);
    };
    loadData();
  }, []);

  // --- MEDIA HANDLERS ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetId: string | null) => {
    if (e.target.files) {
      const newAtts = Array.from(e.target.files).map(file => ({
        file,
        type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document",
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type || "application/octet-stream"
      }));

      if (targetId === "main") {
        setAttachments(prev => [...prev, ...newAtts]);
      } else if (targetId === "goal") {
        setGoalAttachments(prev => [...prev, ...newAtts]);
      } else {
        setSubtasks(prev => prev.map(st => st.id === targetId ? { ...st, attachments: [...st.attachments, ...newAtts] } : st));
      }
    }
  };

  const startRecording = async (targetId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        const previewUrl = URL.createObjectURL(blob);
        const newAtt = { file, type: "audio", previewUrl, mimeType: "audio/webm" };

        if (recordingTargetRef.current === "main") {
          setAttachments(prev => [...prev, newAtt]);
        } else if (recordingTargetRef.current === "goal") {
          setGoalAttachments(prev => [...prev, newAtt]);
        } else {
          setSubtasks(prev => prev.map(st => st.id === recordingTargetRef.current ? { ...st, attachments: [...st.attachments, newAtt] } : st));
        }
        recordingTargetRef.current = null;
        setRecordingTarget(null);
      };
      recordingTargetRef.current = targetId;
      setRecordingTarget(targetId);
      recorder.start();
      setMediaRecorder(recorder);
    } catch (err) {
      alert("Microphone access denied or unavailable.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  };

  const removeAttachment = (targetId: string, index: number) => {
    if (targetId === "main") {
      setAttachments(prev => prev.filter((_, i) => i !== index));
    } else if (targetId === "goal") {
      setGoalAttachments(prev => prev.filter((_, i) => i !== index));
    } else {
      setSubtasks(prev => prev.map(st => st.id === targetId ? { ...st, attachments: st.attachments.filter((_, i) => i !== index) } : st));
    }
  };

  // --- SUBTASKS HANDLERS ---
  const addSubtask = () => {
    setSubtasks([
      ...subtasks,
      { id: Date.now().toString(), title: "", assigneeIds: [], deadlineDate: "", deadlineTime: "", reminder: "", repeat: "", tags: [], attachments: [], showDetails: true, showAssigneeDropdown: false }
    ]);
  };

  const toggleSubtaskTag = (subtaskId: string, tagName: string) => {
    const st = subtasks.find(s => s.id === subtaskId);
    if (!st) return;
    const currentTags = st.tags || [];
    if (currentTags.includes(tagName)) {
      updateSubtask(subtaskId, 'tags', currentTags.filter(t => t !== tagName));
    } else {
      updateSubtask(subtaskId, 'tags', [...currentTags, tagName]);
    }
  };

  const updateSubtask = (id: string, field: keyof Subtask, value: any) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, [field]: value } : st));
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  // --- TAGS HANDLERS ---
  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(t => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !currentUser) return;
    setCreatingTag(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ name: newTagName.trim() })
        .select()
        .single();
      
      if (error) throw error;
      
      if (data) {
        setAvailableTags(prev => [...prev, data]);
        setSelectedTags(prev => [...prev, data.id]);
        setNewTagName("");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to create tag: " + err.message);
    } finally {
      setCreatingTag(false);
    }
  };

  // --- SUBMIT ---
  const uploadFiles = async (taskId: string, files: Attachment[]) => {
    for (const att of files) {
      const fileExt = att.file.name.split('.').pop();
      const fileName = `${Date.now()}-${att.file.name}`; // Use original file name for better identification
      const filePath = `${taskId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('task-attachments').upload(filePath, att.file);
      if (!uploadError) {
        const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/task-attachments/${filePath}`;

        await supabase.from("task_attachments").insert({
          task_id: taskId,
          file_name: att.file.name,
          file_url: fileUrl,
          file_type: att.mimeType,
          uploaded_by: currentUser.id,
          is_completion_proof: false
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentUser) return;
    setLoading(true);

    try {
      // 1. Create Main Task
      const mainDeadline = deadlineDate ? (deadlineTime ? `${deadlineDate}T${deadlineTime}:00` : `${deadlineDate}T23:59:59`) : null;
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          priority: priority,
          status: "todo",
          project_id: projectId || null,
          deadline: mainDeadline,
          reminder_minutes: reminder ? parseInt(reminder) : null,
          recurring_rule: repeat ? { frequency: repeat, interval: 1 } : null,
          tags: selectedTags.length > 0 ? selectedTags : null,
          created_by: currentUser.id,
          sort_order: Math.floor(Date.now() / 1000),
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Assign Users & Create Notifications
      if (assigneeIds.length > 0 && taskData.id) {
        const assignmentsData = assigneeIds.map(aId => ({
          task_id: taskData.id, agent_id: aId, assigned_by: currentUser.id
        }));
        await supabase.from("task_assignments").insert(assignmentsData);

        // Create Notifications for Assignees
        const notificationsData = assigneeIds
          .filter(aId => aId !== currentUser.id) // Don't notify self
          .map(aId => ({
            user_id: aId,
            title: 'New Task Assigned',
            message: `You've been assigned to: ${taskData.title}`,
            type: 'task_assigned',
            reference_id: taskData.id,
            is_read: false
          }));

        if (notificationsData.length > 0) {
          await supabase.from("notifications").insert(notificationsData);
        }
      }

      // Upload Main Attachments
      await uploadFiles(taskData.id, [...attachments, ...goalAttachments]);

      // 2. Create Subtasks
      for (const st of subtasks) {
        if (!st.title.trim()) continue;
        
        const stDeadline = st.deadlineDate ? (st.deadlineTime ? `${st.deadlineDate}T${st.deadlineTime}:00` : `${st.deadlineDate}T23:59:59`) : null;
        const { data: stData, error: stError } = await supabase.from('tasks').insert({
          title: st.title.trim(),
          parent_task_id: taskData.id,
          project_id: projectId || null,
          status: 'todo',
          priority: 'medium',
          deadline: stDeadline,
          reminder_minutes: st.reminder ? parseInt(st.reminder) : null,
          recurring_rule: st.repeat ? { frequency: st.repeat, interval: 1 } : null,
          tags: st.tags && st.tags.length > 0 ? st.tags : null,
          created_by: currentUser.id,
          sort_order: Math.floor(Date.now() / 1000)
        }).select().single();

        if (stData) {
          if (st.assigneeIds && st.assigneeIds.length > 0) {
            const stAssignments = st.assigneeIds.map(aId => ({
               task_id: stData.id, agent_id: aId, assigned_by: currentUser.id
            }));
            await supabase.from("task_assignments").insert(stAssignments);

            // Create Notifications for Subtask Assignees
            const stNotificationsData = st.assigneeIds
              .filter(aId => aId !== currentUser.id) // Don't notify self
              .map(aId => ({
                user_id: aId,
                title: 'New Subtask Assigned',
                message: `You've been assigned to subtask: ${stData.title} (under "${taskData.title}")`,
                type: 'task_assigned',
                reference_id: stData.id,
                is_read: false
              }));

            if (stNotificationsData.length > 0) {
              await supabase.from("notifications").insert(stNotificationsData);
            }
          }
          await uploadFiles(stData.id, st.attachments);
        }
      }

      // Log Activity
      await supabase.from('task_activity').insert({
        task_id: taskData.id, user_id: currentUser.id, action: 'created', details: { message: 'Task created via Web UI' }
      });

      router.push("/");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert("Failed to create task: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "low": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "high": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "urgent": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "";
    }
  };

  if (fetchingData) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-in slide-in-from-bottom-4 duration-500 animate-in">
      <div className="mb-8 flex items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center">
            <Plus className="mr-2 text-primary" size={32} />
            Create New Task
          </h1>
          <p className="text-foreground/60 mt-2 text-sm max-w-2xl">
            Add a new task with rich details including media attachments, checklists, scheduling, and tags.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-10 relative shadow-2xl shadow-primary/5">
        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* --- LEFT COLUMN: CORE INPUTS --- */}
            <div className="lg:col-span-2 space-y-8 text-foreground">
              
              {/* Title Input */}
              <div className="bg-input-bg border border-input-border rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all p-2">
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent px-4 py-4 text-2xl sm:text-3xl font-bold text-foreground placeholder-foreground/20 outline-none" placeholder="What needs to be done?" autoFocus />
                
                {/* Media Row (Moved here like in purchase_app) */}
                <div className="flex items-center gap-3 px-4 pb-3">
                  <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" ref={mainFileInputRef} onChange={(e) => handleFileUpload(e, "main")} />
                  
                  <button type="button" onClick={() => mainFileInputRef.current?.click()} className="flex items-center justify-center w-10 h-10 rounded-full bg-card-bg/60 border border-input-border text-foreground/60 hover:text-primary hover:bg-input-bg transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  
                  <button type="button" onClick={() => recordingTarget === "main" ? stopRecording() : startRecording("main")} className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${recordingTarget === "main" ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' : 'bg-card-bg/60 border-input-border text-foreground/60 hover:text-primary hover:bg-input-bg'}`}>
                    {recordingTarget === "main" ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-input-border bg-input-bg w-24 h-24 flex items-center justify-center">
                      {att.type === 'image' ? <img src={att.previewUrl} alt="Preview" className="w-full h-full object-cover" /> : att.type === 'audio' ? <Mic className="w-8 h-8 text-primary" /> : <ImageIcon className="w-8 h-8 text-foreground/40" />}
                      <button type="button" onClick={() => removeAttachment("main", idx)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Description Box */}
              <div className="bg-input-bg border border-input-border rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all p-2">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent px-4 py-4 text-sm text-foreground/80 placeholder-foreground/30 outline-none resize-none min-h-[100px]" placeholder="Add a more detailed description... (Optional)" />
                
                {/* Media Row for Description (Goal Attachments) */}
                <div className="flex items-center gap-3 px-4 pb-3">
                  <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" ref={goalFileInputRef} onChange={(e) => handleFileUpload(e, "goal")} />
                  
                  <button type="button" onClick={() => goalFileInputRef.current?.click()} className="flex items-center justify-center w-10 h-10 rounded-full bg-card-bg/60 border border-input-border text-foreground/60 hover:text-primary hover:bg-input-bg transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  
                  <button type="button" onClick={() => recordingTarget === "goal" ? stopRecording() : startRecording("goal")} className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${recordingTarget === "goal" ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' : 'bg-card-bg/60 border-input-border text-foreground/60 hover:text-primary hover:bg-input-bg'}`}>
                    {recordingTarget === "goal" ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Goal Attachments Preview */}
              {goalAttachments.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {goalAttachments.map((att, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-input-border bg-input-bg w-24 h-24 flex items-center justify-center">
                      {att.type === 'image' ? <img src={att.previewUrl} alt="Preview" className="w-full h-full object-cover" /> : att.type === 'audio' ? <Mic className="w-8 h-8 text-primary" /> : <ImageIcon className="w-8 h-8 text-foreground/40" />}
                      <button type="button" onClick={() => removeAttachment("goal", idx)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtasks / Checklist */}
              <div className="pt-4 space-y-4">
                <div className="flex flex-col gap-3 md:gap-0 md:flex-row items-start md:items-center justify-between">
                  <label className="flex items-center text-sm font-bold uppercase tracking-wider text-foreground">
                    <CheckSquare className="w-4 h-4 mr-2 text-primary" /> Subtasks & Advanced Checklists
                  </label>
                  <button type="button" onClick={addSubtask} className="text-xs font-bold text-primary hover:text-primary-hover flex items-center bg-primary/10 px-3 py-1.5 rounded-full transition-colors">
                    <Plus className="w-3 h-3 mr-1" /> Add Subtask
                  </button>
                </div>

                {subtasks.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-input-border rounded-2xl text-foreground/40 text-sm font-medium">No subtasks added. Break this task into smaller steps.</div>
                ) : (
                  <div className="space-y-4">
                    {subtasks.map((st, i) => (
                      <div key={st.id} className="bg-input-bg border border-input-border rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded border-2 border-primary/50 shrink-0" />
                          <input type="text" value={st.title} onChange={(e) => updateSubtask(st.id, 'title', e.target.value)} className="bg-transparent flex-1 outline-none text-base font-medium text-foreground" placeholder="What needs to be done?" autoFocus />
                          <button type="button" onClick={() => updateSubtask(st.id, 'showDetails', !st.showDetails)} className="text-xs bg-primary/10 text-primary font-bold px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors">
                            {st.showDetails ? 'Hide Options' : 'Options'}
                          </button>
                          <button type="button" onClick={() => removeSubtask(st.id)} className="text-foreground/40 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        
                        {st.showDetails && (
                          <div className="pt-3 border-t border-input-border space-y-4 mt-1">
                            {/* Subtask Media UI */}
                            <div className="flex items-center gap-4 pt-1">
                              <label className="flex items-center text-xs font-bold text-foreground/60 hover:text-primary cursor-pointer transition-colors">
                                <input type="file" multiple accept="image/*,video/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, st.id)} />
                                <Paperclip className="w-3.5 h-3.5 mr-1" /> Attach File
                              </label>
                              <button type="button" onClick={() => recordingTarget === st.id ? stopRecording() : startRecording(st.id)} className={`flex items-center text-xs font-bold transition-colors ${recordingTarget === st.id ? 'text-red-500 animate-pulse' : 'text-foreground/60 hover:text-primary'}`}>
                                {recordingTarget === st.id ? <Square className="w-3.5 h-3.5 mr-1" /> : <Mic className="w-3.5 h-3.5 mr-1" />}
                                {recordingTarget === st.id ? 'Stop Recording' : 'Record Audio'}
                              </button>
                            </div>

                            {/* Subtask Attachments Preview */}
                            {st.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {st.attachments.map((att, idx) => (
                                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-input-border bg-card-bg w-14 h-14 flex items-center justify-center">
                                    {att.type === 'image' ? <img src={att.previewUrl} alt="Preview" className="w-full h-full object-cover" /> : att.type === 'audio' ? <Mic className="w-5 h-5 text-primary" /> : <ImageIcon className="w-5 h-5 text-foreground/40" />}
                                    <button type="button" onClick={() => removeAttachment(st.id, idx)} className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Subtask Assignee & Deadline Row */}
                            <div className="space-y-1.5 mb-4">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Assign To</label>
                              <div className="relative">
                                <button 
                                  type="button" 
                                  onClick={() => updateSubtask(st.id, 'showAssigneeDropdown', !st.showAssigneeDropdown)}
                                  className="w-full bg-card-bg border border-card-border rounded-lg px-3 py-2 text-xs font-bold text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                                >
                                  <span className="truncate">
                                    {st.assigneeIds?.length > 0 
                                      ? agents.filter(a => st.assigneeIds.includes(a.id)).map(a => a.name).join(", ")
                                      : "Select Assignees"}
                                  </span>
                                  <ChevronRight className={`w-3 h-3 transition-transform ${st.showAssigneeDropdown ? 'rotate-90' : ''}`} />
                                </button>
                                
                                {st.showAssigneeDropdown && (
                                  <div className="absolute z-50 mt-1 w-full bg-card-bg border border-card-border rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto custom-scrollbar">
                                    {agents.map(a => (
                                      <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => {
                                          const current = st.assigneeIds || [];
                                          const newIds = current.includes(a.id) ? current.filter(id => id !== a.id) : [...current, a.id];
                                          updateSubtask(st.id, 'assigneeIds', newIds);
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-primary/10 flex items-center justify-between transition-colors"
                                      >
                                        {a.name}
                                        {st.assigneeIds?.includes(a.id) && <CheckSquare className="w-3 h-3 text-primary" />}
                                      </button>
                                    ))}
                                    {agents.length === 0 && <div className="px-3 py-2 text-xs text-foreground/40 italic">No users found.</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Date</label>
                                <input type="date" value={st.deadlineDate} onChange={(e) => updateSubtask(st.id, 'deadlineDate', e.target.value)} className="w-full bg-card-bg text-xs font-bold border border-card-border rounded-lg px-2 py-2 outline-none text-foreground/70" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Time</label>
                                <input type="time" value={st.deadlineTime} onChange={(e) => updateSubtask(st.id, 'deadlineTime', e.target.value)} className="w-full bg-card-bg text-xs font-bold border border-card-border rounded-lg px-2 py-2 outline-none text-foreground/70" />
                              </div>
                            </div>

                            {/* Subtask Notifications Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                               <div className="relative">
                                <Bell className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-foreground/40" />
                                <select value={st.reminder} onChange={(e) => updateSubtask(st.id, 'reminder', e.target.value)} className="w-full bg-card-bg border border-card-border rounded-lg pl-8 pr-2 py-2 text-xs font-bold outline-none appearance-none">
                                  <option value="">No Reminder</option>
                                  <option value="15">15 mins before</option>
                                  <option value="60">1 hour before</option>
                                  <option value="1440">1 day before</option>
                                </select>
                              </div>
                              <div className="relative">
                                <Repeat className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-foreground/40" />
                                <select value={st.repeat} onChange={(e) => updateSubtask(st.id, 'repeat', e.target.value)} className="w-full bg-card-bg border border-card-border rounded-lg pl-8 pr-2 py-2 text-xs font-bold outline-none appearance-none">
                                  <option value="">Don't Repeat</option>
                                  <option value="daily">Daily</option>
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                                </select>
                              </div>
                            </div>

                            {/* Subtask Tags UI */}
                            <div className="pt-1">
                              <label className="flex items-center text-[10px] font-bold text-foreground/50 uppercase tracking-wider mb-1.5"><TagIcon className="w-3 h-3 mr-1" /> Tags</label>
                              <div className="flex flex-wrap gap-1.5">
                                {availableTags.map(tag => (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => toggleSubtaskTag(st.id, tag.name)}
                                    className={`px-2 py-1 rounded border text-[10px] font-bold transition-colors ${
                                      (st.tags || []).includes(tag.name) 
                                        ? 'bg-primary text-white border-primary' 
                                        : 'bg-card-bg text-foreground/60 border-card-border hover:border-primary/50'
                                    }`}
                                  >
                                    {tag.name}
                                  </button>
                                ))}
                                {availableTags.length === 0 && <span className="text-[10px] text-foreground/40 italic">No tags available.</span>}
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* --- RIGHT COLUMN: SETTINGS --- */}
            <div className="space-y-8 bg-card-bg/30 p-6 rounded-3xl border border-card-border">
              
              {/* Priority */}
              <div className="space-y-3">
                <label className="flex items-center text-xs font-bold uppercase tracking-wider text-foreground/60">
                  <Flag className="w-3.5 h-3.5 mr-2" /> Priority Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["low", "medium", "high", "urgent"] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)} className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all ${priority === p ? getPriorityColor(p) + " shadow-sm" : "bg-input-bg border-transparent text-foreground/50 hover:bg-input-border"}`}>{p}</button>
                  ))}
                </div>
              </div>

              {/* Assignment & Project */}
              <div className="space-y-4">
                 <div className="relative">
                  <label className="flex items-center text-xs font-bold text-foreground/60 mb-2 uppercase tracking-wider"><User className="w-3.5 h-3.5 mr-2" /> Assign To</label>
                  <button 
                    type="button" 
                    onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                    className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-sm font-medium text-left flex items-center justify-between hover:border-primary/50 transition-all outline-none"
                  >
                    <span className="truncate">
                      {assigneeIds.length > 0 
                        ? agents.filter(a => assigneeIds.includes(a.id)).map(a => a.name).join(", ")
                        : "Select Assignees"}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAssigneeDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showAssigneeDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAssigneeDropdown(false)} />
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-card-bg border border-card-border rounded-xl shadow-2xl py-2 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                        {agents.map((a) => (
                          <button 
                            key={a.id} 
                            type="button" 
                            onClick={() => toggleAssignee(a.id)} 
                            className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-primary/10 flex items-center justify-between transition-colors"
                          >
                            <span className={assigneeIds.includes(a.id) ? 'text-primary font-bold' : 'text-foreground/80'}>{a.name}</span>
                            {assigneeIds.includes(a.id) && <CheckSquare className="w-4 h-4 text-primary" />}
                          </button>
                        ))}
                        {agents.length === 0 && <div className="px-4 py-2 text-sm text-foreground/40 italic">No users available.</div>}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="flex items-center text-xs font-bold text-foreground/60 mb-1.5 uppercase tracking-wider"><FolderPlus className="w-3.5 h-3.5 mr-2" /> Project</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full bg-input-bg border border-input-border focus:border-primary rounded-xl px-3 py-3 text-sm font-medium transition-all outline-none appearance-none cursor-pointer">
                    <option value="">No Project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Target Date Section */}
              <div className="space-y-4 pt-4 border-t border-card-border">
                <label className="flex items-center text-xs font-bold text-foreground/60 uppercase tracking-wider"><Calendar className="w-3.5 h-3.5 mr-2" /> Schedule</label>
                
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="bg-input-bg border border-input-border rounded-xl px-3 py-3 text-sm font-medium outline-none text-foreground" />
                  <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="bg-input-bg border border-input-border rounded-xl px-3 py-3 text-sm font-medium outline-none text-foreground" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Bell className="absolute left-3 top-3 w-4 h-4 text-foreground/40" />
                    <select value={reminder} onChange={(e) => setReminder(e.target.value)} className="w-full bg-input-bg border border-input-border rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none appearance-none">
                      <option value="">No Reminder</option>
                      <option value="15">15 mins before</option>
                      <option value="60">1 hour before</option>
                      <option value="1440">1 day before</option>
                    </select>
                  </div>
                  <div className="relative">
                    <Repeat className="absolute left-3 top-3 w-4 h-4 text-foreground/40" />
                    <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="w-full bg-input-bg border border-input-border rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium outline-none appearance-none">
                      <option value="">Don't Repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-3 pt-4 border-t border-card-border">
                <label className="flex items-center text-xs font-bold text-foreground/60 uppercase tracking-wider"><TagIcon className="w-3.5 h-3.5 mr-2" /> Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {availableTags.map(tag => (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.name)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedTags.includes(tag.name) ? 'bg-primary text-white border-primary' : 'bg-input-bg text-foreground/60 border-input-border hover:border-primary/50'}`}>
                      {tag.name}
                    </button>
                  ))}
                  {availableTags.length === 0 && <span className="text-xs text-foreground/40 italic">No tags available in database.</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())} placeholder="New tag name..." className="flex-1 bg-input-bg border border-input-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary transition-colors text-foreground" />
                  <button type="button" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()} className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center">
                    {creatingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                    {creatingTag ? '' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-end items-center relative z-20">
            <button type="button" onClick={() => router.back()} className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-foreground/60 hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} className="w-full sm:w-auto px-10 py-3.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-[0_0_20px_rgba(226,70,129,0.3)] hover:shadow-[0_0_30px_rgba(226,70,129,0.5)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center group">
              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Plus className="w-5 h-5 mr-2 group-hover:scale-125 transition-transform" />}
              {loading ? 'Creating...' : 'Launch Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
