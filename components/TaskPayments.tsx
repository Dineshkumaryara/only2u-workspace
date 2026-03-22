"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  IndianRupee, Plus, FileText, CheckCircle2, 
  XCircle, Clock, Loader2, AlertCircle, Pencil
} from "lucide-react";

export default function TaskPayments({ taskId }: { taskId: string }) {
  const supabase = createClient();
  const [currentAgent, setCurrentAgent] = useState<any>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showPOForm, setShowPOForm] = useState(false);
  const [poAmount, setPoAmount] = useState("");
  
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDesc, setPaymentDesc] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  
  const [poReceipt, setPoReceipt] = useState<File | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = currentAgent?.role?.toLowerCase() === 'admin' || currentAgent?.role?.toLowerCase() === 'manager';

  const fetchData = async () => {
    setLoading(true);
    try {
      /* Extract Authenticated User/Agent details mapping */
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: agent } = await supabase.from('agents').select("*").eq('email', user.email).maybeSingle();
        if (agent) setCurrentAgent({ ...agent, id: user.id }); // Hydrate ID natively to the auth context
      }

      const { data: po } = await supabase.from("task_purchase_orders").select("*").eq("task_id", taskId).maybeSingle();
      setPurchaseOrder(po);

      const { data: pays } = await supabase.from("task_payments")
        .select("*, requester:agents!task_payments_requested_by_fkey(id, name), reviewer:agents!task_payments_reviewed_by_fkey(id, name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      
      if (pays) setPayments(pays);
    } catch (err) {
      console.error("Error fetching payments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [taskId]);

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
    const filePath = `${taskId}/billing/${fileName}`;
    
    const { error: uploadError } = await supabase.storage.from('task-attachments').upload(filePath, file);
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
    return { url: publicUrl, name: file.name };
  };

  const handleSavePO = async () => {
    if (!poAmount || isNaN(Number(poAmount)) || Number(poAmount) <= 0) return;
    const amount = Number(poAmount);

    if (isEditing && amount < purchaseOrder.paid_amount) {
      alert(`New total cannot be less than already paid amount (₹${purchaseOrder.paid_amount})`);
      return;
    }

    if (!isEditing && !poReceipt) {
        alert("Please upload a receipt/bill to generate a PO.");
        return;
    }
    
    setIsSubmitting(true);
    try {
      let billUrls = isEditing ? purchaseOrder.bill_urls : [];
      let billFileNames = isEditing ? purchaseOrder.bill_file_names : [];

      if (poReceipt) {
        const { url, name } = await uploadFile(poReceipt);
        billUrls = [...(billUrls || []), url];
        billFileNames = [...(billFileNames || []), name];
      }

      const payload: any = {
        task_id: taskId,
        created_by: currentAgent?.id,
        total_amount: amount,
        bill_urls: billUrls,
        bill_file_names: billFileNames
      };

      let data, error;
      if (isEditing) {
        const newRemaining = amount - purchaseOrder.paid_amount;
        payload.remaining_amount = Math.max(0, newRemaining);
        payload.status = newRemaining <= 0 ? 'completed' : 'partial';
        ({ data, error } = await supabase.from("task_purchase_orders").update(payload).eq('id', purchaseOrder.id).select().single());
      } else {
        payload.paid_amount = 0;
        payload.remaining_amount = amount;
        payload.status = 'partial';
        ({ data, error } = await supabase.from("task_purchase_orders").insert(payload).select().single());
      }

      if (error) throw error;
      setPurchaseOrder(data);
      setShowPOForm(false);
      setIsEditing(false);
      setPoReceipt(null);
      setPoAmount("");
    } catch (err) {
      console.error("Error saving PO", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0 || !paymentDesc) return;
    if (Number(paymentAmount) > purchaseOrder.remaining_amount && (!isEditingPayment)) {
      alert(`Amount exceeds remaining balance of ₹${purchaseOrder.remaining_amount}`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      let receiptUrl = isEditingPayment ? payments.find(p => p.id === editPaymentId)?.receipt_url : null;
      let receiptName = isEditingPayment ? payments.find(p => p.id === editPaymentId)?.receipt_file_name : null;

      if (paymentReceipt) {
        const up = await uploadFile(paymentReceipt);
        receiptUrl = up.url;
        receiptName = up.name;
      }

      const amount = Number(paymentAmount);
      let data, error;

      if (isEditingPayment && editPaymentId) {
        ({ data, error } = await supabase.from("task_payments").update({
            amount,
            description: paymentDesc,
            receipt_url: receiptUrl,
            receipt_file_name: receiptName,
            status: 'pending' // Reset to pending if edited? Usually yes.
        }).eq('id', editPaymentId).select("*, requester:agents!task_payments_requested_by_fkey(id, name)").single());
      } else {
        ({ data, error } = await supabase.from("task_payments").insert({
            task_id: taskId,
            purchase_order_id: purchaseOrder.id,
            requested_by: currentAgent?.id,
            amount,
            description: paymentDesc,
            status: 'pending',
            receipt_url: receiptUrl,
            receipt_file_name: receiptName
        }).select("*, requester:agents!task_payments_requested_by_fkey(id, name)").single());
      }

      if (error) throw error;
      
      if (isEditingPayment) {
        setPayments(prev => prev.map(p => p.id === editPaymentId ? data : p));
      } else {
        setPayments(prev => [data, ...prev]);
      }

      setShowPaymentForm(false);
      setIsEditingPayment(false);
      setEditPaymentId(null);
      setPaymentAmount("");
      setPaymentDesc("");
      setPaymentReceipt(null);
    } catch (err) {
      console.error("Error saving payment request", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (paymentId: string, amount: number) => {
    try {
      // Approve Payment
      const { error } = await supabase.from("task_payments").update({
        status: 'approved',
        reviewed_by: currentAgent?.id,
        reviewed_at: new Date().toISOString()
      }).eq('id', paymentId);
      
      if (error) throw error;

      // Update PO balances
      const newPaidAmount = purchaseOrder.paid_amount + amount;
      const newRemainingAmount = purchaseOrder.total_amount - newPaidAmount;
      const newStatus = newRemainingAmount <= 0 ? 'completed' : 'partial';

      const { data: newPO } = await supabase.from("task_purchase_orders").update({
        paid_amount: newPaidAmount,
        remaining_amount: Math.max(0, newRemainingAmount),
        status: newStatus
      }).eq('id', purchaseOrder.id).select().single();

      setPurchaseOrder(newPO);
      
      // Update local state
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'approved', reviewer: { name: currentAgent?.name } } : p));
    } catch (err) {
      console.error("Error approving payment", err);
    }
  };

  const handleReject = async (paymentId: string) => {
    const reason = window.prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      const { error } = await supabase.from("task_payments").update({
        status: 'rejected',
        reviewed_by: currentAgent?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason
      }).eq('id', paymentId);
      
      if (error) throw error;
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'rejected', reviewer: { name: currentAgent?.name }, rejection_reason: reason } : p));
    } catch (err) {
      console.error("Error rejecting payment", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'rejected': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    }
  };

  if (loading) return <div className="p-8 text-center text-foreground/50"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-card-border overflow-hidden mt-8">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-bold text-foreground flex items-center">
          <IndianRupee className="w-5 h-5 mr-2 text-primary" />
          Payments & Billing
        </h3>
        
        {!purchaseOrder && (
          <button 
            onClick={() => {
              setIsEditing(false);
              setShowPOForm(!showPOForm);
            }}
            className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-3 py-1.5 rounded-lg flex items-center"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Generate PO
          </button>
        )}
      </div>

      {showPOForm && (
        <div className="bg-input-bg/50 border border-input-border rounded-2xl p-6 mb-8">
          <h4 className="text-sm font-bold text-foreground mb-4">{isEditing ? 'Edit Purchase Order' : 'Generate Purchase Order'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
                <label className="text-xs font-bold text-foreground/60 uppercase tracking-widest mb-2 block">Total Budget Amount (₹)</label>
                <div className="relative">
                <IndianRupee className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
                <input 
                    type="number"
                    value={poAmount}
                    onChange={(e) => setPoAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-card-bg border border-input-border rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none"
                />
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-foreground/60 uppercase tracking-widest mb-2 block">Upload Bill/Receipt {isEditing ? '(Optional to update)' : '(Required)'}</label>
                <input 
                    type="file"
                    onChange={(e) => setPoReceipt(e.target.files?.[0] || null)}
                    className="w-full text-xs text-foreground/50 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-extrabold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer bg-card-bg border border-input-border rounded-xl py-1.5 px-3"
                />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-input-border/30">
            <button onClick={() => { setShowPOForm(false); setIsEditing(false); }} className="px-6 py-2.5 text-sm font-bold text-foreground/60 hover:text-foreground">Cancel</button>
            <button 
                onClick={handleSavePO}
                disabled={isSubmitting || !poAmount || (!isEditing && !poReceipt)}
                className="px-8 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center shadow-lg shadow-primary/20"
            >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} {isEditing ? 'Update PO' : 'Generate PO'}
            </button>
          </div>
        </div>
      )}

      {purchaseOrder && !showPOForm && (
        <>
          {/* PO Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-input-bg/40 border border-input-border rounded-2xl p-4 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 block">Total PO Amount</span>
                {(isAdmin || purchaseOrder.created_by === currentAgent?.id) && (
                  <button 
                    onClick={() => {
                        setPoAmount(purchaseOrder.total_amount.toString());
                        setIsEditing(true);
                        setShowPOForm(true);
                    }}
                    className="p-1.5 rounded-lg bg-input-bg text-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Edit PO"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              <span className="text-xl font-bold text-foreground">₹{purchaseOrder.total_amount.toLocaleString()}</span>
              {purchaseOrder.bill_urls && purchaseOrder.bill_urls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                   {purchaseOrder.bill_urls.map((url: string, idx: number) => (
                     <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 hover:bg-primary/10 transition-colors">
                        <FileText size={10} className="mr-1" /> Bill {idx + 1}
                     </a>
                   ))}
                </div>
              )}
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-500/70 block mb-1">Amount Paid</span>
              <span className="text-xl font-bold text-green-500">₹{purchaseOrder.paid_amount.toLocaleString()}</span>
            </div>
            <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500/70 block mb-1">Balance Remaining</span>
              <span className="text-xl font-bold text-orange-500">₹{purchaseOrder.remaining_amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 border-b border-card-border pb-4">
            <h4 className="text-sm font-bold text-foreground/80">Payment Requests</h4>
            {purchaseOrder.remaining_amount > 0 && (
              <button 
                onClick={() => {
                  setIsEditingPayment(false);
                  setPaymentAmount("");
                  setPaymentDesc("");
                  setShowPaymentForm(!showPaymentForm);
                }}
                className="text-xs font-bold text-foreground bg-input-bg border border-input-border hover:border-primary/50 transition-colors px-3 py-1.5 rounded-lg flex items-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-primary" /> Request Advance
              </button>
            )}
          </div>

          {showPaymentForm && (
            <div className="bg-card-bg border border-input-border rounded-2xl p-6 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-foreground mb-4">{isEditingPayment ? 'Edit Advance Request' : 'New Advance Request'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2 block">Request Amount (₹)</label>
                   <div className="relative">
                    <IndianRupee className="w-3.5 h-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" />
                    <input 
                        type="number" 
                        value={paymentAmount} 
                        onChange={e => setPaymentAmount(e.target.value)} 
                        placeholder="0.00" 
                        className="w-full bg-input-bg border border-input-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none font-bold"
                        />
                   </div>
                 </div>
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2 block">Upload Receipt {isEditingPayment ? '(Optional update)' : '(Optional)'}</label>
                    <input 
                        type="file"
                        onChange={(e) => setPaymentReceipt(e.target.files?.[0] || null)}
                        className="w-full text-[10px] text-foreground/40 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-extrabold file:bg-primary/5 file:text-primary hover:file:bg-primary/10 cursor-pointer bg-input-bg/50 border border-input-border rounded-xl py-1 px-3"
                    />
                 </div>
                 <div className="md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2 block">Reason / Description</label>
                   <input 
                      type="text" 
                      value={paymentDesc} 
                      onChange={e => setPaymentDesc(e.target.value)} 
                      placeholder="E.g. Supplier advance for plumbing materials" 
                      className="w-full bg-input-bg border border-input-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none font-medium"
                    />
                 </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-input-border/30">
                <button onClick={() => { setShowPaymentForm(false); setIsEditingPayment(false); }} className="px-4 py-2 text-xs font-bold text-foreground/60 hover:text-foreground">Cancel</button>
                <button 
                  onClick={handleRequestPayment} 
                  disabled={isSubmitting || !paymentAmount || !paymentDesc} 
                  className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover disabled:opacity-50 flex items-center transition-all shadow-md shadow-primary/10"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null} {isEditingPayment ? 'Update Request' : 'Submit Request'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-input-border rounded-2xl text-foreground/40 text-xs font-bold">No payment requests yet.</div>
            ) : (
              payments.map((pay) => (
                <div key={pay.id} className="bg-input-bg/40 border border-input-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-card-bg border border-card-border flex items-center justify-center shrink-0">
                      <IndianRupee className="w-5 h-5 text-foreground/60" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-extrabold text-foreground">₹{pay.amount.toLocaleString()}</span>
                        <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getStatusColor(pay.status)}`}>
                          {pay.status}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70 font-medium">{pay.description}</p>
                       <div className="flex items-center gap-3 mt-2">
                        <div className="text-[10px] text-foreground/40 uppercase font-bold tracking-widest flex items-center">
                          <UserIcon name={pay.requester?.name || 'User'} /> 
                          <span className="mx-2">•</span> 
                          {new Date(pay.created_at).toLocaleDateString()}
                        </div>
                        {pay.receipt_url && (
                          <a href={pay.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[9px] font-bold text-primary hover:underline">
                            <FileText size={10} className="mr-1" /> Receipt
                          </a>
                        )}
                      </div>
                      
                      {pay.status === 'rejected' && pay.rejection_reason && (
                        <div className="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-xs text-red-500 font-medium">
                          <span className="font-bold flex items-center mb-1"><AlertCircle className="w-3 h-3 mr-1"/> Rejected by {pay.reviewer?.name}</span>
                          {pay.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {pay.status === 'pending' && (isAdmin || pay.requested_by === currentAgent?.id) && (
                    <div className="flex gap-2 shrink-0 border-t border-card-border pt-4 md:border-0 md:pt-0">
                      {pay.requested_by === currentAgent?.id && (
                        <button 
                          onClick={() => {
                            setPaymentAmount(pay.amount.toString());
                            setPaymentDesc(pay.description);
                            setEditPaymentId(pay.id);
                            setIsEditingPayment(true);
                            setShowPaymentForm(true);
                          }}
                          className="w-9 h-9 rounded-full bg-input-bg text-foreground/40 border border-input-border flex items-center justify-center hover:text-primary hover:border-primary/30 transition-colors"
                          title="Edit Request"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button onClick={() => handleReject(pay.id)} className="w-9 h-9 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleApprove(pay.id, pay.amount)} className="w-9 h-9 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

const UserIcon = ({ name }: { name: string }) => (
  <span className="flex items-center text-foreground/60">
    <div className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] mr-1 border border-primary/20">
      {name.charAt(0).toUpperCase()}
    </div>
    {name}
  </span>
);
