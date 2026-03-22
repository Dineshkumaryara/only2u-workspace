import Link from "next/link";
import { Clock, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type TaskCardProps = {
  task: any;
  viewMode?: "board" | "grid" | "list" | "kanban";
};

export const TaskCard = ({ task, viewMode = "board" }: TaskCardProps) => {
  // Find first image attachment (compatible with both purchase_web "image" and purchase_app "image/jpeg" formats)
  const coverImage = task.task_attachments?.find((att: any) => 
    att.file_type === 'image' || att.file_type?.startsWith('image/')
  )?.file_url;
  
  // Assignees
  const assignees = task.task_assignments?.map((ta: any) => ta.agent) || [];

  return (
    <Link href={`/task-management/task/${task.id}`} draggable={false} className="block h-full w-full">
      <div className={`bg-card-bg border border-card-border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group flex relative z-10 hover:z-20 h-full ${viewMode === "list" ? "flex-col sm:flex-row items-stretch" : "flex-col"} ${viewMode === "board" ? "mb-4" : ""} ${task.status === 'completed' ? 'opacity-80 saturate-10' : ''}`}>
        {coverImage && (
          <div className={`overflow-hidden bg-card-bg shrink-0 ${viewMode === "list" ? "w-full sm:w-40 h-32 sm:h-full border-b sm:border-b-0 sm:border-r border-card-border" : "w-full h-32 border-b border-card-border"}`}>
            <img src={coverImage} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        
        <div className={`p-4 flex flex-col gap-3 flex-1 ${viewMode === "list" ? "justify-center" : ""}`}>
          <div className="flex gap-2 flex-wrap items-center">
            {task.status === 'completed' && (
              <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider flex items-center border border-green-500/20">
                <CheckCircle2 size={12} className="mr-1" /> Completed
              </span>
            )}
            
            {task.status !== 'completed' && task.priority === "urgent" && <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Urgent</span>}
            {task.status !== 'completed' && task.priority === "high" && <span className="bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">High</span>}
            {task.status !== 'completed' && task.priority === "medium" && <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Medium</span>}
            {task.status !== 'completed' && task.priority === "low" && <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Low</span>}
            
            {task.tags && task.tags.map((tag: string) => (
              <span key={tag} className="bg-input-bg border border-input-border text-foreground/60 px-2 py-0.5 rounded-md text-[10px] font-bold">
                {tag}
              </span>
            ))}
          </div>

          <h3 className={`font-bold text-sm line-clamp-2 leading-relaxed ${task.status === 'completed' ? 'text-foreground/50 line-through' : 'text-foreground'}`}>
            {task.title}
          </h3>

          <div className="flex items-center justify-between mt-1">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-foreground/50">
               {task.deadline && (
                 <div className="flex items-center gap-1">
                   <CalendarIcon size={12} />
                   <span className={new Date(task.deadline) < new Date() && task.status !== 'completed' ? 'text-red-500' : ''}>
                     {format(new Date(task.deadline), 'MMM d')}
                   </span>
                 </div>
               )}
               {task.created_at && (
                 <div className="flex items-center gap-1 opacity-70">
                   <Clock size={12} />
                   {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                 </div>
               )}
            </div>

            {assignees.length > 0 && (
              <div className="flex -space-x-1.5">
                {assignees.slice(0, 3).map((agent: any, i: number) => (
                  <div key={agent.id} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card-bg flex items-center justify-center text-[10px] font-bold text-primary z-[3-i]" style={{ zIndex: 10 - i }}>
                    {agent.name ? agent.name.substring(0,1).toUpperCase() : '?'}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
