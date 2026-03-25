"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import {
  Calendar, User, Loader2, Save, Flag, FolderPlus,
  ArrowLeft, Bell, Repeat, Tag as TagIcon, Plus, ChevronDown, CheckSquare,
  Paperclip, Mic, Square, Trash2, X, ChevronRight, FileText, Image as ImageIcon
} from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";

type Attachment = { file?: File; file_url?: string; file_name: string; file_type: string; previewUrl?: string; mimeType?: string; id?: string };

type Subtask = {
  id: string; // Temporary ID for new ones, DB ID for existing ones
  dbId?: string;
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
  isDeleted?: boolean;
};

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  // Data
  const [agents, setAgents] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [parentTask, setParentTask] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- FORM STATE ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [projectId, setProjectId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [originalAssigneeIds, setOriginalAssigneeIds] = useState<string[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Subtasks State
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [recordingTarget, setRecordingTarget] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

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

  // Parent Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // --- INITIAL LOAD ---
  useEffect(() => {
    if (!id) return;
    
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      const isSuperAdmin = useUserStore.getState().isSuperAdmin;

      // Fetch projects with RBAC
      let projectsQuery = supabase.from("projects").select("id, name").eq("status", "active").order("name");
      if (!isSuperAdmin) {
        const { data: memberData } = await supabase.from('project_members').select('project_id').eq('user_id', user.id);
        const memberProjectIds = memberData?.map(m => m.project_id) || [];
        
        if (memberProjectIds.length > 0) {
          projectsQuery = projectsQuery.or(`user_id.eq.${user.id},id.in.(${memberProjectIds.map(id => `"${id}"`).join(',')})`);
        } else {
          projectsQuery = projectsQuery.eq('user_id', user.id);
        }
      }

      const [
        { data: agData }, 
        { data: prData }, 
        { data: tgData },
        { data: taskData },
        { data: assignData },
        { data: subtaskData },
        { data: mainAttData }
      ] = await Promise.all([
        supabase.from("agents").select("id, name, email").order("name"),
        projectsQuery,
        supabase.from("tags").select("*").order("name"),
        supabase.from("tasks").select("*").eq("id", id).single(),
        supabase.from("task_assignments").select("agent_id").eq("task_id", id),
        supabase.from("tasks").select("*, task_assignments(agent:agents(*)), task_attachments(*)").eq("parent_task_id", id).order("sort_order", { ascending: true }),
        supabase.from("task_attachments").select("*").eq("task_id", id)
      ]);

      if (agData) setAgents(agData);
      if (prData) setProjects(prData);
      if (tgData) setAvailableTags(tgData);

      if (taskData) {
        // If it's a subtask, fetch parent info
        if (taskData.parent_task_id) {
          const { data: pData } = await supabase.from("tasks").select("id, title").eq("id", taskData.parent_task_id).single();
          setParentTask(pData);
        }

        // Only creator or super admin should edit
        if (!isSuperAdmin && user?.id !== taskData.created_by) {
          alert("You don't have permission to edit this task.");
          router.push(`/task-management/task/${id}`);
          return;
        }

        setTitle(taskData.title || "");
        setDescription(taskData.description || "");
        setPriority(taskData.priority || "medium");
        setProjectId(taskData.project_id || "");
        
        if (taskData.deadline) {
           const d = new Date(taskData.deadline);
           setDeadlineDate(d.toISOString().split('T')[0]);
           setDeadlineTime(d.toTimeString().slice(0, 5));
        }

        if (taskData.reminder_minutes) setReminder(taskData.reminder_minutes.toString());
        if (taskData.recurring_rule?.frequency) setRepeat(taskData.recurring_rule.frequency);
        if (taskData.tags) setSelectedTags(taskData.tags);
      }

      if (assignData) {
        const ids = assignData.map((a: any) => a.agent_id);
        setAssigneeIds(ids);
        setOriginalAssigneeIds(ids);
      }

      if (subtaskData) {
        const mappedSubtasks: Subtask[] = subtaskData.map((st: any) => {
          let dDate = "", dTime = "";
          if (st.deadline) {
            const d = new Date(st.deadline);
            dDate = d.toISOString().split('T')[0];
            dTime = d.toTimeString().slice(0, 5);
          }
          return {
            id: st.id,
            dbId: st.id,
            title: st.title,
            assigneeIds: st.task_assignments?.map((ta: any) => ta.agent_id) || [],
            deadlineDate: dDate,
            deadlineTime: dTime,
            reminder: st.reminder_minutes?.toString() || "",
            repeat: st.recurring_rule?.frequency || "",
            tags: st.tags || [],
            attachments: st.task_attachments || [],
            showDetails: false,
            showAssigneeDropdown: false
          };
        });
        setSubtasks(mappedSubtasks);
      }

      if (mainAttData) {
        setAttachments(mainAttData);
      }

      setFetchingData(false);
    };
    loadData();
  }, [id, router, supabase]);

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

  // --- SUBTASKS HANDLERS ---
  const addSubtask = () => {
    setSubtasks([
      ...subtasks,
      { id: Date.now().toString(), title: "", assigneeIds: [], deadlineDate: "", deadlineTime: "", reminder: "", repeat: "", tags: [], attachments: [], showDetails: true, showAssigneeDropdown: false }
    ]);
  };

  const updateSubtask = (sid: string, field: keyof Subtask, value: any) => {
    setSubtasks(subtasks.map(st => st.id === sid ? { ...st, [field]: value } : st));
  };

  const removeSubtask = (sid: string) => {
    setSubtasks(subtasks.map(st => st.id === sid ? { ...st, isDeleted: true } : st));
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
        const newAtt = { file, file_name: file.name, file_type: "audio", previewUrl, mimeType: "audio/webm" };

        setSubtasks(prev => prev.map(st => st.id === targetId ? { ...st, attachments: [...st.attachments, newAtt] } : st));
        setRecordingTarget(null);
      };
      setRecordingTarget(targetId);
      recorder.start();
      setMediaRecorder(recorder);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetId: string) => {
    if (e.target.files) {
      const newAtts = Array.from(e.target.files).map(file => ({
        file,
        file_name: file.name,
        file_type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document",
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type || "application/octet-stream"
      }));
      setSubtasks(prev => prev.map(st => st.id === targetId ? { ...st, attachments: [...st.attachments, ...newAtts] } : st));
    }
  };

  const removeAttachment = (sid: string | null, index: number) => {
    if (sid === null) {
      setAttachments(prev => prev.filter((_, i) => i !== index));
    } else {
      setSubtasks(prev => prev.map(st => st.id === sid ? { ...st, attachments: st.attachments.filter((_, i) => i !== index) } : st));
    }
  };

  const handleMainFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newAtts = Array.from(e.target.files).map(file => ({
        file,
        file_name: file.name,
        file_type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document",
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type || "application/octet-stream"
      }));
      setAttachments(prev => [...prev, ...newAtts]);
    }
  };

  const startMainRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        const previewUrl = URL.createObjectURL(blob);
        const newAtt = { file, file_name: file.name, file_type: "audio", previewUrl, mimeType: "audio/webm" };
        setAttachments(prev => [...prev, newAtt]);
        setRecordingTarget(null);
      };
      setRecordingTarget("main");
      recorder.start();
      setMediaRecorder(recorder);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const uploadFiles = async (taskId: string, files: Attachment[]) => {
    for (const att of files) {
      if (att.file) { // Only upload new files
        const fileName = `${Date.now()}-${att.file_name}`;
        const filePath = `${taskId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('task-attachments').upload(filePath, att.file);
        if (!uploadError) {
          const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/task-attachments/${filePath}`;
          await supabase.from("task_attachments").insert({
            task_id: taskId, file_name: att.file_name, file_url: fileUrl, file_type: att.mimeType, uploaded_by: currentUser.id
          });
        }
      }
    }
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentUser) return;
    setLoading(true);

    try {
      const mainDeadline = deadlineDate ? (deadlineTime ? `${deadlineDate}T${deadlineTime}:00` : `${deadlineDate}T23:59:59`) : null;
      
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          priority: priority,
          project_id: projectId || null,
          deadline: mainDeadline,
          reminder_minutes: reminder ? parseInt(reminder) : null,
          recurring_rule: repeat ? { frequency: repeat, interval: 1 } : null,
          tags: selectedTags.length > 0 ? selectedTags : null,
        })
        .eq("id", id);

      if (taskError) throw taskError;

      // Sync Main Attachments
      const currentMainAtts = await supabase.from("task_attachments").select("id").eq("task_id", id);
      const existingIds = attachments.filter(a => a.id).map(a => a.id);
      const toDelete = currentMainAtts.data?.filter(a => !existingIds.includes(a.id)).map(a => a.id) || [];
      if (toDelete.length > 0) await supabase.from("task_attachments").delete().in("id", toDelete);
      await uploadFiles(id, attachments);

      // Update Assignees
      const addedAssignees = assigneeIds.filter(aId => !originalAssigneeIds.includes(aId));
      const removedAssignees = originalAssigneeIds.filter(aId => !assigneeIds.includes(aId));

      if (removedAssignees.length > 0) {
        await supabase.from("task_assignments").delete().eq("task_id", id).in("agent_id", removedAssignees);
      }
      
      if (addedAssignees.length > 0) {
        const assignmentsData = addedAssignees.map(aId => ({
          task_id: id, agent_id: aId, assigned_by: currentUser.id
        }));
        await supabase.from("task_assignments").insert(assignmentsData);

        // Notify new assignees
        const notificationsData = addedAssignees
          .filter(aId => aId !== currentUser.id)
          .map(aId => ({
            user_id: aId,
            title: 'New Task Assigned',
            message: `You've been assigned to: ${title}`,
            type: 'task_assigned',
            reference_id: id,
            is_read: false
          }));
        
        if (notificationsData.length > 0) {
          await supabase.from("notifications").insert(notificationsData);
        }
      }

      // --- HANDLE SUBTASKS ---
      for (const st of subtasks) {
        if (st.isDeleted) {
           if (st.dbId) {
             // Fully delete or archive? Let's delete associated stuff first
             await supabase.from("task_assignments").delete().eq("task_id", st.dbId);
             await supabase.from("task_attachments").delete().eq("task_id", st.dbId);
             await supabase.from("tasks").delete().eq("id", st.dbId);
           }
           continue;
        }

        const stDeadline = st.deadlineDate ? (st.deadlineTime ? `${st.deadlineDate}T${st.deadlineTime}:00` : `${st.deadlineDate}T23:59:59`) : null;
        const subtaskPayload = {
            title: st.title.trim(),
            parent_task_id: id,
            project_id: projectId || null,
            status: 'todo',
            priority: 'medium',
            deadline: stDeadline,
            reminder_minutes: st.reminder ? parseInt(st.reminder) : null,
            recurring_rule: st.repeat ? { frequency: st.repeat, interval: 1 } : null,
            tags: st.tags && st.tags.length > 0 ? st.tags : null,
            created_by: currentUser.id,
            sort_order: Math.floor(Date.now() / 1000)
        };

        let sid = st.dbId;
        if (st.dbId) {
          // Update Existing
          await supabase.from("tasks").update(subtaskPayload).eq("id", st.dbId);
        } else {
          // Insert New
          const { data: newSt } = await supabase.from("tasks").insert(subtaskPayload).select().single();
          sid = newSt?.id;
        }

        if (sid) {
          // Sync Assignments
          const { data: currentAssigns } = await supabase.from("task_assignments").select("agent_id").eq("task_id", sid);
          const currentIds = currentAssigns?.map(a => a.agent_id) || [];
          const added = st.assigneeIds.filter(aId => !currentIds.includes(aId));
          const removed = currentIds.filter(aId => !st.assigneeIds.includes(aId));

          if (removed.length > 0) await supabase.from("task_assignments").delete().eq("task_id", sid).in("agent_id", removed);
          if (added.length > 0) {
            await supabase.from("task_assignments").insert(added.map(aId => ({ task_id: sid, agent_id: aId, assigned_by: currentUser.id })));
            
            // Notify new subtask assignees
            const stNotificationsData = added
              .filter(aId => aId !== currentUser.id)
              .map(aId => ({
                user_id: aId,
                title: 'New Subtask Assigned',
                message: `You've been assigned to subtask: ${st.title} (under "${title}")`,
                type: 'task_assigned',
                reference_id: sid,
                is_read: false
              }));
            
            if (stNotificationsData.length > 0) {
              await supabase.from("notifications").insert(stNotificationsData);
            }
          }

          // Sync Subtask Attachments
          const currSubAtts = await supabase.from("task_attachments").select("id").eq("task_id", sid);
          const stExistingIds = st.attachments.filter(a => a.id).map(a => a.id);
          const stToDelete = currSubAtts.data?.filter(a => !stExistingIds.includes(a.id)).map(a => a.id) || [];
          if (stToDelete.length > 0) await supabase.from("task_attachments").delete().in("id", stToDelete);
          await uploadFiles(sid, st.attachments);
        }
      }

      // Log Activity
      await supabase.from('task_activity').insert({
        task_id: id, user_id: currentUser.id, action_type: 'title_changed', action_data: { message: 'Task updated via Web UI' }
      });

      router.push(`/task-management/task/${id}`);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert("Failed to update task: " + err.message);
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="flex items-center text-sm font-bold text-foreground/60 hover:text-foreground transition-colors group mb-4">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>

          {/* Subtask Context Breadcrumb */}
          {parentTask && (
            <Link href={`/task-management/task/${parentTask.id}`} className="flex items-center text-xs font-bold text-primary hover:text-primary-hover mb-3 group/parent">
               <ArrowLeft className="w-3.5 h-3.5 mr-1.5 opacity-60 group-hover/parent:-translate-x-0.5 transition-transform" />
               Subtask of: <span className="underline ml-1 decoration-primary/30">{parentTask.title}</span>
            </Link>
          )}

          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center">
            Edit Task
          </h1>
          <p className="text-foreground/60 mt-2 text-sm max-w-2xl">
            Update the details, scheduling, and tags for this task.
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
              </div>

              {/* Description Box */}
              <div className="bg-input-bg border border-input-border rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all p-2">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent px-4 py-4 text-sm text-foreground/80 placeholder-foreground/30 outline-none resize-none min-h-[200px] custom-scrollbar" placeholder="Add a more detailed description... (Optional)" />
              </div>

              {/* Parent Attachments Section */}
              <div className="bg-input-bg border border-input-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-sm font-bold uppercase tracking-wider text-foreground">
                    <Paperclip className="w-4 h-4 mr-2 text-primary" /> Task Attachments
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-primary hover:text-primary-hover flex items-center bg-primary/10 px-3 py-1.5 rounded-full transition-colors cursor-pointer">
                      <input type="file" multiple className="hidden" onChange={handleMainFileUpload} />
                      <Plus className="w-3 h-3 mr-1" /> Add Files
                    </label>
                    <button type="button" onClick={() => recordingTarget === 'main' ? stopRecording() : startMainRecording()} className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center ${recordingTarget === 'main' ?'bg-red-500 text-white animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                      {recordingTarget === 'main' ? <Square className="w-3 h-3 mr-1" /> : <Mic className="w-3 h-3 mr-1" />}
                      {recordingTarget === 'main' ? 'Stop' : 'Voice Note'}
                    </button>
                  </div>
                </div>

                {attachments.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-input-border rounded-xl text-foreground/30 text-xs font-bold uppercase tracking-widest">No attachments</div>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-input-border bg-card-bg shadow-sm flex items-center justify-center">
                        {att.file_type === 'image' || att.file_type?.startsWith('image/') ? (
                          <img src={att.file_url || att.previewUrl} className="w-full h-full object-cover" alt="Preview" />
                        ) : att.file_type === 'audio' || att.file_type?.startsWith('audio/') ? (
                          <div className="flex flex-col items-center gap-1">
                            <Mic className="w-6 h-6 text-primary" />
                            <span className="text-[8px] font-bold text-foreground/40 uppercase truncate px-2 w-full text-center">Audio</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <FileText className="w-6 h-6 text-foreground/40" />
                            <span className="text-[8px] font-bold text-foreground/40 uppercase truncate px-2 w-full text-center">{att.file_name}</span>
                          </div>
                        )}
                        <button type="button" onClick={() => removeAttachment(null, idx)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtasks Section */}
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-sm font-bold uppercase tracking-wider text-foreground">
                    <CheckSquare className="w-4 h-4 mr-2 text-primary" /> Subtasks & Checklist
                  </label>
                  <button type="button" onClick={addSubtask} className="text-xs font-bold text-primary hover:text-primary-hover flex items-center bg-primary/10 px-3 py-1.5 rounded-full transition-colors">
                    <Plus className="w-3 h-3 mr-1" /> Add Subtask
                  </button>
                </div>

                {subtasks.filter(st => !st.isDeleted).length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-input-border rounded-2xl text-foreground/40 text-sm font-medium">No subtasks added.</div>
                ) : (
                  <div className="space-y-4">
                    {subtasks.filter(st => !st.isDeleted).map((st) => (
                      <div key={st.id} className="bg-input-bg border border-input-border rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded border-2 border-primary/50 shrink-0" />
                          <input type="text" value={st.title} onChange={(e) => updateSubtask(st.id, 'title', e.target.value)} className="bg-transparent flex-1 outline-none text-base font-medium text-foreground" placeholder="What needs to be done?" />
                          <button type="button" onClick={() => updateSubtask(st.id, 'showDetails', !st.showDetails)} className="text-xs bg-primary/10 text-primary font-bold px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors">
                            {st.showDetails ? 'Hide Options' : 'Options'}
                          </button>
                          <button type="button" onClick={() => removeSubtask(st.id)} className="text-foreground/40 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        
                        {st.showDetails && (
                          <div className="pt-3 border-t border-input-border space-y-4 mt-1">
                            <div className="flex items-center gap-4 pt-1">
                              <label className="flex items-center text-xs font-bold text-foreground/60 hover:text-primary cursor-pointer transition-colors">
                                <input type="file" multiple accept="image/*,video/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, st.id)} />
                                <Paperclip className="w-3.5 h-3.5 mr-1" /> Attach File
                              </label>
                              <button type="button" onClick={() => recordingTarget === st.id ? stopRecording() : startRecording(st.id)} className={`flex items-center text-xs font-bold transition-colors ${recordingTarget === st.id ? 'text-red-500 animate-pulse' : 'text-foreground/60 hover:text-primary'}`}>
                                {recordingTarget === st.id ? <Square className="w-3.5 h-3.5 mr-1" /> : <Mic className="w-3.5 h-3.5 mr-1" />}
                                {recordingTarget === st.id ? 'Stop' : 'Record'}
                              </button>
                            </div>

                            {st.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {st.attachments.map((att, idx) => (
                                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-input-border bg-card-bg w-14 h-14 flex items-center justify-center">
                                    {att.file_type === 'image' ? <img src={att.file_url || att.previewUrl} alt="Preview" className="w-full h-full object-cover" /> : att.file_type === 'audio' ? <Mic className="w-5 h-5 text-primary" /> : <ImageIcon className="w-5 h-5 text-foreground/40" />}
                                    <button type="button" onClick={() => removeAttachment(st.id, idx)} className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="space-y-1.5 mb-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Assign To</label>
                              <div className="relative">
                                <button type="button" onClick={() => updateSubtask(st.id, 'showAssigneeDropdown', !st.showAssigneeDropdown)} className="w-full bg-card-bg border border-card-border rounded-lg px-3 py-2 text-xs font-bold text-left flex items-center justify-between hover:border-primary/50 transition-colors">
                                  <span className="truncate">{st.assigneeIds?.length > 0 ? agents.filter(a => st.assigneeIds.includes(a.id)).map(a => a.name).join(", ") : "Select Assignees"}</span>
                                  <ChevronRight className={`w-3 h-3 transition-transform ${st.showAssigneeDropdown ? 'rotate-90' : ''}`} />
                                </button>
                                {st.showAssigneeDropdown && (
                                  <div className="absolute z-50 mt-1 w-full bg-card-bg border border-card-border rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto custom-scrollbar">
                                    {agents.map(a => (
                                      <button key={a.id} type="button" onClick={() => {
                                        const ids = st.assigneeIds || [];
                                        updateSubtask(st.id, 'assigneeIds', ids.includes(a.id) ? ids.filter(x => x !== a.id) : [...ids, a.id]);
                                      }} className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-primary/10 flex items-center justify-between transition-colors">
                                        {a.name} {st.assigneeIds?.includes(a.id) && <CheckSquare className="w-3 h-3 text-primary" />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Date</label>
                                <input type="date" value={st.deadlineDate} onChange={(e) => updateSubtask(st.id, 'deadlineDate', e.target.value)} className="w-full bg-card-bg text-xs font-bold border border-card-border rounded-lg px-2 py-2 outline-none" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Time</label>
                                <input type="time" value={st.deadlineTime} onChange={(e) => updateSubtask(st.id, 'deadlineTime', e.target.value)} className="w-full bg-card-bg text-xs font-bold border border-card-border rounded-lg px-2 py-2 outline-none" />
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
              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />}
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
