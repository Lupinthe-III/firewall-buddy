import { useMemo, useState } from "react";
import {
  Shield, Users, Globe, Plus, Trash2, Network, Lock, TrendingUp,
  Calculator, RotateCcw, ShieldCheck, Sparkles, AlertCircle, Server,
  Activity, FileDown, Eye, KeyRound, Zap, Bug, Filter, Layers,
  Building2, Gauge, Wifi, Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

// ===== Types =====
type Mode = "quick" | "advanced";
type UsageProfile = "light" | "medium" | "heavy";
type BusinessType = "corporate" | "callcenter" | "software" | "education" | "retail";
type InterfaceType = "100m" | "1g_rj45" | "1g_sfp" | "10g_sfp" | "25g_sfp28";

interface ISP { id: string; name: string; bandwidth: string; }

interface FeatureDef {
  id: string;
  label: string;
  multiplier: number; // throughput remaining factor when enabled (lower = heavier)
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface VendorModel { name: string; throughput: number; /* Mbps */ }
interface VendorDB { vendor: string; models: VendorModel[]; }

// ===== Static Data =====
const FEATURES: FeatureDef[] = [
  { id: "firewall",  label: "Firewall",            multiplier: 1.0, tooltip: "Stateful packet inspection (baseline)", icon: Shield },
  { id: "ips",       label: "IPS / IDS",           multiplier: 0.8, tooltip: "Intrusion prevention reduces effective throughput ~20%", icon: Activity },
  { id: "webfilter", label: "Web Filtering",       multiplier: 0.85, tooltip: "URL & category-based filtering", icon: Filter },
  { id: "appctrl",   label: "Application Control", multiplier: 0.7, tooltip: "Layer-7 application identification", icon: Layers },
  { id: "av",        label: "Antivirus",           multiplier: 0.75, tooltip: "Inline virus scanning", icon: Bug },
  { id: "ssl",       label: "SSL Inspection",      multiplier: 0.5, tooltip: "TLS decryption — heaviest impact (~50%)", icon: Eye },
];

const INTERFACE_OPTIONS: { id: InterfaceType; label: string }[] = [
  { id: "100m",     label: "10/100 Mbps (RJ45)" },
  { id: "1g_rj45",  label: "1G RJ45" },
  { id: "1g_sfp",   label: "1G SFP" },
  { id: "10g_sfp",  label: "10G SFP+" },
  { id: "25g_sfp28",label: "25G SFP28" },
];

const VENDOR_DB: VendorDB[] = [
  { vendor: "Fortinet", models: [
    { name: "FortiGate 40F",  throughput: 600 },
    { name: "FortiGate 60F",  throughput: 1000 },
    { name: "FortiGate 100F", throughput: 5000 },
  ]},
  { vendor: "Palo Alto", models: [
    { name: "PA-220", throughput: 500 },
    { name: "PA-440", throughput: 1000 },
  ]},
  { vendor: "Cisco", models: [
    { name: "Firepower 1010", throughput: 650 },
    { name: "Firepower 1120", throughput: 2000 },
  ]},
  { vendor: "Sophos", models: [
    { name: "XGS 87",  throughput: 800 },
    { name: "XGS 116", throughput: 2000 },
  ]},
  { vendor: "Huawei", models: [
    { name: "USG6305", throughput: 1000 },
    { name: "USG6310", throughput: 3000 },
  ]},
];

const ALL_VENDORS = VENDOR_DB.map((v) => v.vendor);

const USAGE_FACTOR: Record<UsageProfile, number> = { light: 0.8, medium: 1.0, heavy: 1.3 };
const BUSINESS_FACTOR: Record<BusinessType, number> = {
  corporate: 1.0, callcenter: 1.2, software: 1.3, education: 0.9, retail: 0.8,
};

// ===== State =====
interface FormState {
  mode: Mode;
  users: string;
  isps: ISP[];
  interfaceCount: string;
  interfaceTypes: InterfaceType[];
  features: string[];
  vendors: string[];
  // advanced
  usage: UsageProfile;
  business: BusinessType;
  growth: number; // 0-100
  vpnUsers: string;
  ha: boolean;
}

const newISP = (name = "", bandwidth = ""): ISP => ({
  id: Math.random().toString(36).slice(2, 9), name, bandwidth,
});

const initialState: FormState = {
  mode: "quick",
  users: "",
  isps: [newISP("ISP 1", "")],
  interfaceCount: "",
  interfaceTypes: ["1g_rj45"],
  features: ["firewall"],
  vendors: [...ALL_VENDORS],
  usage: "medium",
  business: "corporate",
  growth: 30,
  vpnUsers: "",
  ha: false,
};

// ===== Logic =====
interface VendorRecommendation {
  vendor: string;
  minimum: { model: VendorModel; utilization: number; risk: string } | null;
  recommended: { model: VendorModel; utilization: number; risk: string; headroom: number } | null;
}

interface Result {
  totalBandwidth: number;
  userLoad: number;
  vpnLoad: number;
  baseThroughput: number;
  requiredThroughput: number; // Mbps after security + growth + HA
  securityMultiplier: number;
  growthFactor: number;
  recommendations: VendorRecommendation[];
}

function riskFromUtilization(u: number): string {
  if (u >= 80) return "High Risk";
  if (u >= 50) return "Optimal";
  return "Oversized";
}

function computeResult(form: FormState): Result {
  const isAdvanced = form.mode === "advanced";
  const totalBandwidth = form.isps.reduce((s, i) => s + (Number(i.bandwidth) || 0), 0);
  const usersN = Number(form.users) || 0;
  const baseUserLoad = usersN * 2;

  const businessMul = isAdvanced ? BUSINESS_FACTOR[form.business] : 1.0;
  const usageMul = isAdvanced ? USAGE_FACTOR[form.usage] : 1.0;
  const userLoad = baseUserLoad * businessMul * usageMul;
  const vpnLoad = isAdvanced ? (Number(form.vpnUsers) || 0) * 1.5 : 0;

  const baseThroughput = totalBandwidth + userLoad + vpnLoad;

  const securityMultiplier = form.features.reduce(
    (acc, id) => acc * (FEATURES.find((f) => f.id === id)?.multiplier ?? 1),
    1
  );
  // base / multiplier  (lower multiplier = need MORE throughput)
  let required = baseThroughput / (securityMultiplier || 1);

  const growthFactor = isAdvanced ? 1 + form.growth / 100 : 1;
  required = required * growthFactor;

  const haOverhead = isAdvanced && form.ha ? 1.2 : 1.0;
  required = required * haOverhead;

  const recommendations: VendorRecommendation[] = form.vendors.map((vName) => {
    const v = VENDOR_DB.find((x) => x.vendor === vName);
    if (!v) return { vendor: vName, minimum: null, recommended: null };
    const sorted = [...v.models].sort((a, b) => a.throughput - b.throughput);
    const minModel = sorted.find((m) => m.throughput >= required) ?? null;
    const recModel = sorted.find((m) => m.throughput >= required * 1.5) ?? null;
    return {
      vendor: vName,
      minimum: minModel
        ? { model: minModel, utilization: (required / minModel.throughput) * 100, risk: riskFromUtilization((required / minModel.throughput) * 100) }
        : null,
      recommended: recModel
        ? {
            model: recModel,
            utilization: (required / recModel.throughput) * 100,
            risk: riskFromUtilization((required / recModel.throughput) * 100),
            headroom: ((recModel.throughput - required) / recModel.throughput) * 100,
          }
        : null,
    };
  });

  return {
    totalBandwidth,
    userLoad,
    vpnLoad,
    baseThroughput,
    requiredThroughput: required,
    securityMultiplier,
    growthFactor,
    recommendations,
  };
}

// ===== Component =====
export const FirewallSizingTool = () => {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const totalBandwidth = useMemo(
    () => form.isps.reduce((s, i) => s + (Number(i.bandwidth) || 0), 0),
    [form.isps]
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const updateISP = (id: string, patch: Partial<ISP>) => {
    setForm((f) => ({ ...f, isps: f.isps.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    setErrors((e) => ({ ...e, isps: "" }));
  };
  const addISP = () => setForm((f) => ({ ...f, isps: [...f.isps, newISP(`ISP ${f.isps.length + 1}`, "")] }));
  const removeISP = (id: string) => setForm((f) => ({ ...f, isps: f.isps.filter((i) => i.id !== id) }));

  const toggleIn = <T extends string>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.users || Number(form.users) <= 0) e.users = "Enter a valid number of users";
    const hasInvalidIsp = form.isps.some((i) => !i.bandwidth || Number(i.bandwidth) <= 0);
    if (form.isps.length === 0 || hasInvalidIsp) e.isps = "Each ISP needs a bandwidth > 0";
    if (form.features.length === 0) e.features = "Select at least one feature";
    if (form.vendors.length === 0) e.vendors = "Select at least one vendor";
    if (form.mode === "advanced" && (!form.interfaceCount || Number(form.interfaceCount) <= 0))
      e.interfaceCount = "Enter total interfaces";
    if (form.mode === "advanced" && form.interfaceTypes.length === 0)
      e.interfaceTypes = "Select at least one interface type";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const calculate = () => {
    if (!validate()) {
      toast({ title: "Please review the form", description: "Some fields need your attention.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult(computeResult(form));
      setLoading(false);
      setTimeout(
        () => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80
      );
    }, 600);
  };

  const reset = () => {
    setForm(initialState);
    setErrors({});
    setResult(null);
  };

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    let y = 18;
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.text("Firewall Sizing Report", 14, 18);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleString(), W - 14, 18, { align: "right" });

    y = 40;
    doc.setTextColor(20);
    doc.setFontSize(13);
    doc.text("Inputs", 14, y); y += 7;
    doc.setFontSize(10);
    const lines = [
      `Mode: ${form.mode === "quick" ? "Quick" : "Advanced"}`,
      `Total Users: ${form.users}`,
      `ISPs: ${form.isps.map((i) => `${i.name} (${i.bandwidth} Mbps)`).join(", ")}`,
      `Total Bandwidth: ${result.totalBandwidth} Mbps`,
      `Features: ${form.features.map((id) => FEATURES.find((f) => f.id === id)?.label).join(", ")}`,
      `Vendors: ${form.vendors.join(", ")}`,
      ...(form.mode === "advanced" ? [
        `Usage: ${form.usage} · Business: ${form.business}`,
        `Growth: ${form.growth}% · VPN Users: ${form.vpnUsers || 0} · HA: ${form.ha ? "Yes" : "No"}`,
        `Interfaces: ${form.interfaceCount} (${form.interfaceTypes.join(", ")})`,
      ] : []),
    ];
    lines.forEach((l) => {
      const wrapped = doc.splitTextToSize(l, W - 28);
      doc.text(wrapped, 14, y);
      y += 6 * wrapped.length;
    });

    y += 4;
    doc.setFontSize(13);
    doc.text("Required Throughput", 14, y); y += 7;
    doc.setFontSize(11);
    doc.text(`${result.requiredThroughput.toFixed(0)} Mbps (${(result.requiredThroughput / 1000).toFixed(2)} Gbps)`, 14, y); y += 9;

    doc.setFontSize(13);
    doc.text("Vendor Recommendations", 14, y); y += 7;
    doc.setFontSize(10);
    result.recommendations.forEach((r) => {
      doc.setFont(undefined, "bold");
      doc.text(r.vendor, 14, y); y += 5;
      doc.setFont(undefined, "normal");
      doc.text(`Minimum: ${r.minimum ? `${r.minimum.model.name} — ${r.minimum.model.throughput} Mbps (${r.minimum.utilization.toFixed(0)}% util, ${r.minimum.risk})` : "No matching model"}`, 18, y); y += 5;
      doc.text(`Recommended: ${r.recommended ? `${r.recommended.model.name} — ${r.recommended.model.throughput} Mbps (${r.recommended.utilization.toFixed(0)}% util, ${r.recommended.risk})` : "No matching model"}`, 18, y); y += 7;
    });

    doc.save("firewall-sizing-report.pdf");
    toast({ title: "PDF exported", description: "Your sizing report is downloading." });
  };

  const fieldError = (key: string) =>
    errors[key] && (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" /> {errors[key]}
      </p>
    );

  const isAdv = form.mode === "advanced";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen px-4 py-8 sm:py-14">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="text-center mb-8 animate-fade-in-up">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-hero shadow-glow mb-5">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-hero bg-clip-text text-transparent">
              Firewall Sizing Tool
            </h1>
            <p className="text-muted-foreground mt-3 text-sm sm:text-lg max-w-2xl mx-auto">
              Smart sizing across vendors — Minimum &amp; Recommended options
            </p>

            {/* Mode toggle */}
            <div className="inline-flex mt-6 p-1 rounded-lg border border-border bg-card">
              {(["quick", "advanced"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => update("mode", m)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    form.mode === m
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "quick" ? "Quick Mode" : "Advanced Mode"}
                </button>
              ))}
            </div>
          </header>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Users */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <SectionTitle icon={Users} title="Number of Users" />
                <Input
                  type="number" min="0" placeholder="e.g. 250"
                  value={form.users}
                  onChange={(e) => update("users", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter individual users — multiple devices per user are already considered.
                </p>
                {fieldError("users")}
              </Card>

              {/* ISPs */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle icon={Globe} title="ISP Configuration" noMargin />
                  <Button size="sm" variant="outline" onClick={addISP} className="gap-1">
                    <Plus className="h-4 w-4" /> Add ISP
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.isps.map((isp, idx) => (
                    <div key={isp.id} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg border border-border/60 bg-background/40">
                      <div className="col-span-12 sm:col-span-6">
                        <Label className="text-xs text-muted-foreground">ISP Name (optional)</Label>
                        <Input
                          placeholder={`ISP ${idx + 1}`} value={isp.name} maxLength={60}
                          onChange={(e) => updateISP(isp.id, { name: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-5">
                        <Label className="text-xs text-muted-foreground">Bandwidth (Mbps)</Label>
                        <Input
                          type="number" min="0" placeholder="e.g. 500"
                          value={isp.bandwidth}
                          onChange={(e) => updateISP(isp.id, { bandwidth: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-end justify-end h-full">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => removeISP(isp.id)}
                          disabled={form.isps.length === 1}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove ISP"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {fieldError("isps")}
                <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-accent/40 border border-primary/20">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> Total ISP Bandwidth
                  </span>
                  <span className="text-base font-bold text-primary">{totalBandwidth.toLocaleString()} Mbps</span>
                </div>
              </Card>

              {/* Security Features */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <SectionTitle icon={Lock} title="Security Features" />
                <div className="grid sm:grid-cols-2 gap-2">
                  {FEATURES.map((f) => {
                    const checked = form.features.includes(f.id);
                    const Icon = f.icon;
                    return (
                      <Tooltip key={f.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => update("features", toggleIn(form.features, f.id))}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                              checked
                                ? "border-primary bg-accent/50 shadow-sm"
                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                            }`}
                          >
                            <Icon className={`h-4 w-4 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="text-sm font-medium flex-1">{f.label}</span>
                            <span className="text-[10px] text-muted-foreground">×{f.multiplier}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{f.tooltip}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                {fieldError("features")}
              </Card>

              {/* Vendor Selection */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <SectionTitle icon={Server} title="Vendors" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_VENDORS.map((v) => {
                    const checked = form.vendors.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update("vendors", toggleIn(form.vendors, v))}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                          checked
                            ? "border-primary bg-accent/50 text-foreground shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                {fieldError("vendors")}
              </Card>

              {/* Advanced Section */}
              {isAdv && (
                <>
                  {/* Interfaces */}
                  <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                    <SectionTitle icon={Network} title="Network Interfaces" />
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Interfaces Required</Label>
                        <Input
                          type="number" min="0" placeholder="e.g. 8"
                          value={form.interfaceCount}
                          onChange={(e) => update("interfaceCount", e.target.value)}
                          className="mt-1"
                        />
                        {fieldError("interfaceCount")}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Interface Types</Label>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {INTERFACE_OPTIONS.map((i) => {
                            const checked = form.interfaceTypes.includes(i.id);
                            return (
                              <button
                                key={i.id} type="button"
                                onClick={() => update("interfaceTypes", toggleIn(form.interfaceTypes, i.id))}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all ${
                                  checked
                                    ? "border-primary bg-accent/50 shadow-sm"
                                    : "border-border hover:border-primary/40"
                                }`}
                              >
                                <Wifi className={`h-4 w-4 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                                {i.label}
                              </button>
                            );
                          })}
                        </div>
                        {fieldError("interfaceTypes")}
                      </div>
                    </div>
                  </Card>

                  {/* Profile */}
                  <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                    <SectionTitle icon={Building2} title="Business &amp; Usage Profile" />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                          Business Type
                          <Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent>Different industries generate different traffic patterns.</TooltipContent></Tooltip>
                        </Label>
                        <Select value={form.business} onValueChange={(v) => update("business", v as BusinessType)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corporate">Corporate Office (×1.0)</SelectItem>
                            <SelectItem value="callcenter">Call Center / BPO (×1.2)</SelectItem>
                            <SelectItem value="software">Software House (×1.3)</SelectItem>
                            <SelectItem value="education">Educational Institute (×0.9)</SelectItem>
                            <SelectItem value="retail">Retail / Branch (×0.8)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                          Usage Profile
                          <Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent>Adjusts user-load based on typical traffic intensity.</TooltipContent></Tooltip>
                        </Label>
                        <Select value={form.usage} onValueChange={(v) => update("usage", v as UsageProfile)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light (Email, Browsing) ×0.8</SelectItem>
                            <SelectItem value="medium">Medium (Office, Cloud) ×1.0</SelectItem>
                            <SelectItem value="heavy">Heavy (Streaming, SaaS) ×1.3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>

                  {/* Growth + VPN + HA */}
                  <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                    <SectionTitle icon={TrendingUp} title="Growth, VPN &amp; HA" />
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium">Expected Growth (next 2–3 years)</Label>
                          <span className="text-sm font-bold text-primary">{form.growth}%</span>
                        </div>
                        <Slider
                          value={[form.growth]} min={0} max={100} step={5}
                          onValueChange={(v) => update("growth", v[0])}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-1">
                          <KeyRound className="h-4 w-4 text-primary" /> VPN / Remote Users
                        </Label>
                        <Input
                          type="number" min="0" placeholder="e.g. 50"
                          value={form.vpnUsers}
                          onChange={(e) => update("vpnUsers", e.target.value)}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">+1.5 Mbps load per VPN user.</p>
                      </div>
                      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/60">
                        <div>
                          <div className="text-sm font-medium">High Availability (Active-Passive)</div>
                          <div className="text-xs text-muted-foreground">Adds ~20% overhead for failover sync.</div>
                        </div>
                        <Switch checked={form.ha} onCheckedChange={(v) => update("ha", v)} />
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={calculate} size="lg" disabled={loading}
                  className="flex-1 bg-gradient-hero hover:opacity-95 shadow-elevated text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                  {loading ? "Calculating..." : "Calculate Sizing"}
                </Button>
                <Button onClick={reset} size="lg" variant="outline">
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
              <Card className="bg-gradient-result border-primary/20 shadow-card p-5 animate-fade-in-up">
                <div className="flex items-center gap-2 text-primary mb-3">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Live Preview</span>
                </div>
                {totalBandwidth > 0 && Number(form.users) > 0 ? (
                  <div className="space-y-3">
                    <Stat label="ISP Bandwidth" value={`${totalBandwidth.toLocaleString()} Mbps`} />
                    <Stat label="Users" value={form.users} />
                    <Stat label="Vendors" value={String(form.vendors.length)} />
                    <Stat label="Features" value={String(form.features.length)} accent />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enter users &amp; ISP bandwidth to preview.
                  </p>
                )}
              </Card>
            </aside>
          </div>

          {/* Loading */}
          {loading && (
            <div className="mt-10 flex items-center justify-center gap-3 text-muted-foreground animate-fade-in-up">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Sizing across {form.vendors.length} vendor{form.vendors.length > 1 ? "s" : ""}...</span>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <Card
              id="result"
              className="mt-10 p-6 sm:p-8 bg-gradient-result border-primary/20 shadow-elevated animate-scale-in"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Sizing Result</span>
                </div>
                <Button onClick={exportPDF} variant="outline" size="sm">
                  <FileDown className="h-4 w-4" /> Export PDF
                </Button>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <ResultStat label="Total ISP" value={`${result.totalBandwidth.toLocaleString()}`} unit="Mbps" />
                <ResultStat
                  label="Required Throughput"
                  value={(result.requiredThroughput / 1000).toFixed(2)}
                  unit="Gbps" highlight
                  sub={`${result.requiredThroughput.toFixed(0)} Mbps`}
                />
                <ResultStat
                  label="Security Impact"
                  value={`÷${result.securityMultiplier.toFixed(2)}`}
                  sub={isAdv ? `Growth ×${result.growthFactor.toFixed(2)}` : "No growth applied"}
                />
              </div>

              <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                <Server className="h-4 w-4 text-primary" /> Vendor Recommendations
              </h3>
              <div className="space-y-4">
                {result.recommendations.map((r) => (
                  <div key={r.vendor} className="p-4 rounded-xl bg-card border border-border/60">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <h4 className="text-base font-bold">{r.vendor}</h4>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <ModelCard label="Minimum (No Growth Buffer)" tone="warn" rec={r.minimum} />
                      <ModelCard label="Recommended (Future Ready)" tone="ok" rec={r.recommended} headroom />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-6 italic border-t border-border/50 pt-4">
                Sizing is indicative — always validate final selection against vendor datasheets with all enabled services.
              </p>
            </Card>
          )}

          <footer className="text-center text-xs text-muted-foreground mt-10">
            Built for sales &amp; pre-sales teams · Fortinet · Palo Alto · Cisco · Sophos · Huawei
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
};

// ===== Sub-components =====
const SectionTitle = ({
  icon: Icon, title, noMargin,
}: { icon: React.ComponentType<{ className?: string }>; title: string; noMargin?: boolean }) => (
  <div className={`flex items-center gap-2 ${noMargin ? "" : "mb-4"}`}>
    <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <h2 className="text-base font-semibold">{title}</h2>
  </div>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-semibold ${accent ? "text-primary" : ""}`}>{value}</span>
  </div>
);

const ResultStat = ({
  label, value, unit, highlight, sub,
}: { label: string; value: string; unit?: string; highlight?: boolean; sub?: string }) => (
  <div className="p-5 rounded-xl bg-card border border-border/60 shadow-card">
    <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    <div className={`mt-2 font-bold ${highlight ? "text-3xl bg-gradient-hero bg-clip-text text-transparent" : "text-2xl"}`}>
      {value} {unit && <span className="text-sm font-medium">{unit}</span>}
    </div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

const ModelCard = ({
  label, rec, tone, headroom,
}: {
  label: string;
  rec: { model: VendorModel; utilization: number; risk: string; headroom?: number } | null;
  tone: "warn" | "ok";
  headroom?: boolean;
}) => {
  if (!rec) {
    return (
      <div className="p-4 rounded-lg border border-dashed border-border/60 bg-muted/30">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium mt-2 text-muted-foreground">No matching model in dataset</div>
      </div>
    );
  }
  const riskColor =
    rec.risk === "High Risk"
      ? "text-destructive bg-destructive/10 border-destructive/30"
      : rec.risk === "Optimal"
      ? "text-primary bg-primary/10 border-primary/30"
      : "text-muted-foreground bg-muted border-border";
  return (
    <div className={`p-4 rounded-lg border ${tone === "ok" ? "border-primary/30 bg-primary/5" : "border-border bg-background/40"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-bold mt-1">{rec.model.name}</div>
      <div className="text-xs text-muted-foreground">{rec.model.throughput.toLocaleString()} Mbps throughput</div>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground"><Gauge className="h-3 w-3" /> Utilization</span>
          <span className="font-semibold">{rec.utilization.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${rec.utilization >= 80 ? "bg-destructive" : rec.utilization >= 50 ? "bg-primary" : "bg-muted-foreground/40"}`}
            style={{ width: `${Math.min(100, rec.utilization)}%` }}
          />
        </div>
        {headroom && rec.headroom !== undefined && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">Growth Headroom</span>
            <span className="font-semibold text-primary">{rec.headroom.toFixed(0)}%</span>
          </div>
        )}
        <div className={`mt-2 inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${riskColor}`}>
          {rec.risk}
        </div>
      </div>
    </div>
  );
};
