import { useMemo, useState } from "react";
import {
  Shield, Users, Globe, Plus, Trash2, Network, Lock, TrendingUp,
  Calculator, RotateCcw, ShieldCheck, Sparkles, AlertCircle, Server,
  Activity, FileDown, Eye, KeyRound, Zap, Bug, Filter, Layers,
  Building2, Gauge, Wifi, Loader2, SlidersHorizontal,
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
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

// ===== Types =====
type UsageProfile = "light" | "medium" | "heavy";
type BusinessType = "corporate" | "callcenter" | "software" | "education" | "retail";
type InterfaceType = "100m" | "1g_rj45" | "1g_sfp" | "10g_sfp" | "25g_sfp28";

interface ISP { id: string; name: string; bandwidth: string; }

interface FeatureDef {
  id: string;
  label: string;
  multiplier: number;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface VendorModel {
  name: string;
  throughput: number; // Mbps
  ports: Record<InterfaceType, number>;
}
interface VendorDB { vendor: string; models: VendorModel[]; }

// ===== Static Data =====
const FEATURES: FeatureDef[] = [
  { id: "firewall",  label: "Firewall",            multiplier: 1.0,  tooltip: "Stateful packet inspection (baseline)", icon: Shield },
  { id: "ips",       label: "IPS / IDS",           multiplier: 0.8,  tooltip: "Intrusion prevention reduces effective throughput ~20%", icon: Activity },
  { id: "webfilter", label: "Web Filtering",       multiplier: 0.85, tooltip: "URL & category-based filtering", icon: Filter },
  { id: "appctrl",   label: "Application Control", multiplier: 0.7,  tooltip: "Layer-7 application identification", icon: Layers },
  { id: "av",        label: "Antivirus",           multiplier: 0.75, tooltip: "Inline virus scanning", icon: Bug },
  { id: "ssl",       label: "SSL Inspection",      multiplier: 0.5,  tooltip: "TLS decryption — heaviest impact (~50%)", icon: Eye },
];

const INTERFACE_OPTIONS: { id: InterfaceType; label: string; short: string }[] = [
  { id: "100m",      label: "10/100 Mbps (RJ45)", short: "100M" },
  { id: "1g_rj45",   label: "1G RJ45",            short: "1G RJ45" },
  { id: "1g_sfp",    label: "1G SFP",             short: "1G SFP" },
  { id: "10g_sfp",   label: "10G SFP+",           short: "10G SFP+" },
  { id: "25g_sfp28", label: "25G SFP28",          short: "25G SFP28" },
];

const emptyPorts = (): Record<InterfaceType, number> =>
  ({ "100m": 0, "1g_rj45": 0, "1g_sfp": 0, "10g_sfp": 0, "25g_sfp28": 0 });

const mkPorts = (p: Partial<Record<InterfaceType, number>>): Record<InterfaceType, number> =>
  ({ ...emptyPorts(), ...p });

const VENDOR_DB: VendorDB[] = [
  { vendor: "Fortinet", models: [
    { name: "FortiGate 40F",   throughput: 600,   ports: mkPorts({ "1g_rj45": 5 }) },
    { name: "FortiGate 60F",   throughput: 1000,  ports: mkPorts({ "1g_rj45": 10 }) },
    { name: "FortiGate 100F",  throughput: 5000,  ports: mkPorts({ "1g_rj45": 22, "1g_sfp": 4, "10g_sfp": 2 }) },
    { name: "FortiGate 200F",  throughput: 10000, ports: mkPorts({ "1g_rj45": 18, "1g_sfp": 8, "10g_sfp": 4 }) },
    { name: "FortiGate 600F",  throughput: 36000, ports: mkPorts({ "1g_rj45": 16, "10g_sfp": 16, "25g_sfp28": 4 }) },
  ]},
  { vendor: "Palo Alto", models: [
    { name: "PA-220",  throughput: 500,   ports: mkPorts({ "1g_rj45": 8 }) },
    { name: "PA-440",  throughput: 1000,  ports: mkPorts({ "1g_rj45": 8 }) },
    { name: "PA-1410", throughput: 9300,  ports: mkPorts({ "1g_rj45": 12, "10g_sfp": 4 }) },
    { name: "PA-3410", throughput: 21000, ports: mkPorts({ "1g_rj45": 8, "10g_sfp": 12, "25g_sfp28": 4 }) },
  ]},
  { vendor: "Cisco", models: [
    { name: "Firepower 1010", throughput: 650,   ports: mkPorts({ "1g_rj45": 8 }) },
    { name: "Firepower 1120", throughput: 2000,  ports: mkPorts({ "1g_rj45": 8, "1g_sfp": 4 }) },
    { name: "Firepower 2130", throughput: 7500,  ports: mkPorts({ "1g_rj45": 12, "10g_sfp": 4 }) },
    { name: "Firepower 3120", throughput: 25000, ports: mkPorts({ "10g_sfp": 8, "25g_sfp28": 8 }) },
  ]},
  { vendor: "Sophos", models: [
    { name: "XGS 87",   throughput: 800,   ports: mkPorts({ "1g_rj45": 4 }) },
    { name: "XGS 116",  throughput: 2000,  ports: mkPorts({ "1g_rj45": 8 }) },
    { name: "XGS 2100", throughput: 11500, ports: mkPorts({ "1g_rj45": 8, "1g_sfp": 4, "10g_sfp": 2 }) },
    { name: "XGS 5500", throughput: 27000, ports: mkPorts({ "1g_rj45": 8, "10g_sfp": 8, "25g_sfp28": 4 }) },
  ]},
  { vendor: "Huawei", models: [
    { name: "USG6305",  throughput: 1000,  ports: mkPorts({ "100m": 2, "1g_rj45": 8 }) },
    { name: "USG6310",  throughput: 3000,  ports: mkPorts({ "1g_rj45": 8, "1g_sfp": 4 }) },
    { name: "USG6525E", throughput: 12000, ports: mkPorts({ "1g_rj45": 8, "10g_sfp": 4 }) },
    { name: "USG12000", throughput: 40000, ports: mkPorts({ "10g_sfp": 16, "25g_sfp28": 8 }) },
  ]},
];

const ALL_VENDORS = VENDOR_DB.map((v) => v.vendor);

const USAGE_FACTOR: Record<UsageProfile, number> = { light: 0.8, medium: 1.0, heavy: 1.3 };
const BUSINESS_FACTOR: Record<BusinessType, number> = {
  corporate: 1.0, callcenter: 1.2, software: 1.3, education: 0.9, retail: 0.8,
};

// ===== State =====
interface FormState {
  users: string;
  business: BusinessType;
  usage: UsageProfile;
  isps: ISP[];
  interfaces: Record<InterfaceType, string>;
  features: string[];
  vendors: string[];
  growth: number;
  vpnUsers: string;
  ha: boolean;
}

const newISP = (name = "", bandwidth = ""): ISP => ({
  id: Math.random().toString(36).slice(2, 9), name, bandwidth,
});

const initialState: FormState = {
  users: "",
  business: "corporate",
  usage: "medium",
  isps: [newISP("ISP 1", "")],
  interfaces: { "100m": "", "1g_rj45": "", "1g_sfp": "", "10g_sfp": "", "25g_sfp28": "" },
  features: ["firewall"],
  vendors: [...ALL_VENDORS],
  growth: 30,
  vpnUsers: "",
  ha: false,
};

// ===== Logic =====
interface VendorRecommendation {
  vendor: string;
  minimum: { model: VendorModel; utilization: number; risk: string } | null;
  recommended: { model: VendorModel; utilization: number; risk: string; headroom: number } | null;
  excludedReason?: string;
}

interface Result {
  totalBandwidth: number;
  userLoad: number;
  vpnLoad: number;
  baseThroughput: number;
  requiredThroughput: number;
  securityMultiplier: number;
  growthFactor: number;
  totalInterfaces: number;
  recommendations: VendorRecommendation[];
}

function riskFromUtilization(u: number): string {
  if (u >= 80) return "High Risk";
  if (u >= 50) return "Optimal";
  return "Oversized";
}

function modelMeetsPorts(model: VendorModel, req: Record<InterfaceType, number>): boolean {
  return INTERFACE_OPTIONS.every(({ id }) => model.ports[id] >= (req[id] || 0));
}

function computeResult(form: FormState): Result {
  const totalBandwidth = form.isps.reduce((s, i) => s + (Number(i.bandwidth) || 0), 0);
  const usersN = Number(form.users) || 0;
  const baseUserLoad = usersN * 2;

  const businessMul = BUSINESS_FACTOR[form.business];
  const usageMul = USAGE_FACTOR[form.usage];
  const userLoad = baseUserLoad * businessMul * usageMul;
  const vpnLoad = (Number(form.vpnUsers) || 0) * 1.5;

  const baseThroughput = totalBandwidth + userLoad + vpnLoad;

  const securityMultiplier = form.features.reduce(
    (acc, id) => acc * (FEATURES.find((f) => f.id === id)?.multiplier ?? 1),
    1
  );
  let required = baseThroughput / (securityMultiplier || 1);
  const growthFactor = 1 + form.growth / 100;
  required = required * growthFactor;
  const haOverhead = form.ha ? 1.2 : 1.0;
  required = required * haOverhead;

  const portReq: Record<InterfaceType, number> = {
    "100m": Number(form.interfaces["100m"]) || 0,
    "1g_rj45": Number(form.interfaces["1g_rj45"]) || 0,
    "1g_sfp": Number(form.interfaces["1g_sfp"]) || 0,
    "10g_sfp": Number(form.interfaces["10g_sfp"]) || 0,
    "25g_sfp28": Number(form.interfaces["25g_sfp28"]) || 0,
  };
  const totalInterfaces = Object.values(portReq).reduce((a, b) => a + b, 0);

  const recommendations: VendorRecommendation[] = form.vendors.map((vName) => {
    const v = VENDOR_DB.find((x) => x.vendor === vName);
    if (!v) return { vendor: vName, minimum: null, recommended: null };
    const sorted = [...v.models].sort((a, b) => a.throughput - b.throughput);
    const eligible = totalInterfaces > 0
      ? sorted.filter((m) => modelMeetsPorts(m, portReq))
      : sorted;

    const minModel = eligible.find((m) => m.throughput >= required) ?? null;
    const recModel = eligible.find((m) => m.throughput >= required * 1.5) ?? null;

    const reason = totalInterfaces > 0 && eligible.length === 0
      ? "No model in dataset has the required interface mix"
      : undefined;

    return {
      vendor: vName,
      excludedReason: reason,
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
    totalInterfaces,
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

  const totalInterfaces = useMemo(
    () => INTERFACE_OPTIONS.reduce((s, o) => s + (Number(form.interfaces[o.id]) || 0), 0),
    [form.interfaces]
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const updateInterface = (id: InterfaceType, value: string) => {
    setForm((f) => ({ ...f, interfaces: { ...f.interfaces, [id]: value } }));
    setErrors((e) => ({ ...e, interfaces: "" }));
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
    }, 500);
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
    const interfaceSummary = INTERFACE_OPTIONS
      .map((o) => `${o.short}: ${Number(form.interfaces[o.id]) || 0}`)
      .join(", ");
    const lines = [
      `Total Users: ${form.users}`,
      `Business: ${form.business} · Usage: ${form.usage}`,
      `ISPs: ${form.isps.map((i) => `${i.name} (${i.bandwidth} Mbps)`).join(", ")}`,
      `Total Bandwidth: ${result.totalBandwidth} Mbps`,
      `Interfaces (${result.totalInterfaces}): ${interfaceSummary}`,
      `Features: ${form.features.map((id) => FEATURES.find((f) => f.id === id)?.label).join(", ")}`,
      `Vendors: ${form.vendors.join(", ")}`,
      `Growth: ${form.growth}% · VPN Users: ${form.vpnUsers || 0} · HA: ${form.ha ? "Yes" : "No"}`,
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
      if (r.excludedReason) {
        doc.text(`Excluded: ${r.excludedReason}`, 18, y); y += 7;
        return;
      }
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
              Accurate sizing based on real network and security requirements
            </p>
          </header>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-gradient-card shadow-card border-border/60 animate-fade-in-up">
                <Accordion
                  type="multiple"
                  defaultValue={["users", "isps", "interfaces", "features", "advanced"]}
                  className="px-4 sm:px-6"
                >
                  {/* USERS & BUSINESS */}
                  <AccordionItem value="users" className="border-border/60">
                    <AccordionTrigger className="hover:no-underline py-5">
                      <SectionTitle icon={Users} title="Users & Business Details" noMargin />
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 space-y-5">
                      <div>
                        <Label className="text-sm font-medium">Total Users</Label>
                        <Input
                          type="number" min="0" placeholder="e.g. 250"
                          value={form.users}
                          onChange={(e) => update("users", e.target.value)}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter individual users — multiple devices per user are already considered.
                        </p>
                        {fieldError("users")}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-primary" /> Business Type
                          </Label>
                          <Select value={form.business} onValueChange={(v) => update("business", v as BusinessType)}>
                            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
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
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Activity className="h-4 w-4 text-primary" /> Usage Profile
                          </Label>
                          <Select value={form.usage} onValueChange={(v) => update("usage", v as UsageProfile)}>
                            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light (Email, Browsing) ×0.8</SelectItem>
                              <SelectItem value="medium">Medium (Office, Cloud) ×1.0</SelectItem>
                              <SelectItem value="heavy">Heavy (Streaming, SaaS) ×1.3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ISPs */}
                  <AccordionItem value="isps" className="border-border/60">
                    <AccordionTrigger className="hover:no-underline py-5">
                      <SectionTitle icon={Globe} title="ISP Configuration" noMargin />
                    </AccordionTrigger>
                    <AccordionContent className="pb-6">
                      <div className="flex justify-end mb-3">
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
                    </AccordionContent>
                  </AccordionItem>

                  {/* INTERFACES */}
                  <AccordionItem value="interfaces" className="border-border/60">
                    <AccordionTrigger className="hover:no-underline py-5">
                      <SectionTitle icon={Network} title="Network Interfaces" noMargin />
                    </AccordionTrigger>
                    <AccordionContent className="pb-6">
                      <p className="text-xs text-muted-foreground mb-4">
                        Specify the exact number of interfaces required for each type. This ensures accurate
                        hardware model selection based on port availability.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {INTERFACE_OPTIONS.map((opt) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-background/40"
                          >
                            <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                              <Wifi className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-sm font-medium block truncate">{opt.label}</Label>
                            </div>
                            <Input
                              type="number" min="0" placeholder="0"
                              value={form.interfaces[opt.id]}
                              onChange={(e) => updateInterface(opt.id, e.target.value)}
                              className="w-20 text-center"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-accent/40 border border-primary/20">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Network className="h-4 w-4 text-primary" /> Total Interfaces
                        </span>
                        <span className="text-base font-bold text-primary">{totalInterfaces}</span>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* SECURITY FEATURES */}
                  <AccordionItem value="features" className="border-border/60">
                    <AccordionTrigger className="hover:no-underline py-5">
                      <SectionTitle icon={Lock} title="Security Features" noMargin />
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 space-y-5">
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

                      <div>
                        <Label className="text-sm font-medium flex items-center gap-1 mb-2">
                          <Server className="h-4 w-4 text-primary" /> Vendors to Compare
                        </Label>
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
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ADVANCED */}
                  <AccordionItem value="advanced" className="border-b-0">
                    <AccordionTrigger className="hover:no-underline py-5">
                      <SectionTitle icon={SlidersHorizontal} title="Advanced Options" noMargin />
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-primary" /> Expected Growth (next 2–3 years)
                          </Label>
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
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
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
                    <Stat label="Interfaces" value={String(totalInterfaces)} />
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
                  label="Interfaces / Security"
                  value={String(result.totalInterfaces)}
                  sub={`÷${result.securityMultiplier.toFixed(2)} · Growth ×${result.growthFactor.toFixed(2)}`}
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
                    {r.excludedReason ? (
                      <div className="p-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> {r.excludedReason}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <ModelCard label="Minimum (No Growth Buffer)" tone="warn" rec={r.minimum} />
                        <ModelCard label="Recommended (Future Ready)" tone="ok" rec={r.recommended} headroom />
                      </div>
                    )}
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
  const portsList = INTERFACE_OPTIONS
    .filter((o) => rec.model.ports[o.id] > 0)
    .map((o) => `${rec.model.ports[o.id]}× ${o.short}`)
    .join(" · ");
  return (
    <div className={`p-4 rounded-lg border ${tone === "ok" ? "border-primary/30 bg-primary/5" : "border-border bg-background/40"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-bold mt-1">{rec.model.name}</div>
      <div className="text-xs text-muted-foreground">{rec.model.throughput.toLocaleString()} Mbps throughput</div>
      {portsList && <div className="text-[11px] text-muted-foreground mt-1">{portsList}</div>}
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
