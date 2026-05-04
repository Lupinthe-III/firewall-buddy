import { useMemo, useState } from "react";
import {
  Shield, Users, Globe, Plus, Trash2, Network, Cable, Lock, TrendingUp,
  Calculator, RotateCcw, ShieldCheck, Sparkles, AlertCircle, Server,
  Activity, FileDown, Layers, Eye, KeyRound, Zap, Bug, Filter,
} from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

type MediaType = "copper" | "sfp" | "mixed";
type Growth = "0" | "20" | "50" | "100";

interface ISP { id: string; name: string; bandwidth: string; }

interface FeatureDef {
  id: string;
  label: string;
  category: string;
  multiplier: number;
  base?: boolean;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FEATURES: FeatureDef[] = [
  { id: "firewall", label: "Firewall", category: "Core Security", multiplier: 0.2, base: true, tooltip: "Stateful packet inspection (base 1.2×)", icon: Shield },
  { id: "nat", label: "NAT", category: "Core Security", multiplier: 0.1, tooltip: "Network Address Translation", icon: Network },
  { id: "ips", label: "IPS / IDS", category: "Advanced Threat Protection", multiplier: 0.5, tooltip: "Intrusion Prevention / Detection", icon: Activity },
  { id: "av", label: "Antivirus", category: "Advanced Threat Protection", multiplier: 0.3, tooltip: "Signature-based virus scanning", icon: Bug },
  { id: "amal", label: "Anti-Malware", category: "Advanced Threat Protection", multiplier: 0.3, tooltip: "Advanced malware protection / sandboxing", icon: Bug },
  { id: "appctrl", label: "Application Control", category: "Application & Web Control", multiplier: 0.4, tooltip: "Identify & control apps (Layer 7)", icon: Layers },
  { id: "webfilter", label: "Web Filtering", category: "Application & Web Control", multiplier: 0.3, tooltip: "URL/category filtering", icon: Filter },
  { id: "ssl", label: "SSL Inspection", category: "Encryption & Traffic Inspection", multiplier: 1.0, tooltip: "Decrypt and inspect TLS traffic (heavy)", icon: Eye },
  { id: "vpn", label: "VPN", category: "Connectivity", multiplier: 0.3, tooltip: "Site-to-site & remote access VPN", icon: KeyRound },
];

const CATEGORIES = [
  "Core Security",
  "Advanced Threat Protection",
  "Application & Web Control",
  "Encryption & Traffic Inspection",
  "Connectivity",
];

interface FormState {
  users: string;
  isps: ISP[];
  oneG: string;
  tenG: string;
  twentyFiveG: string;
  media: MediaType;
  features: string[];
  growth: Growth;
  ha: boolean;
  siem: boolean;
}

const newISP = (name = "", bandwidth = ""): ISP => ({
  id: Math.random().toString(36).slice(2, 9),
  name,
  bandwidth,
});

const initialState: FormState = {
  users: "",
  isps: [newISP("ISP 1", "")],
  oneG: "",
  tenG: "",
  twentyFiveG: "",
  media: "copper",
  features: ["firewall"],
  growth: "0",
  ha: false,
  siem: false,
};

interface Result {
  totalBandwidth: number;
  throughputMbps: number;
  throughputGbps: number;
  category: "Entry-Level" | "Mid-Range" | "High-End / Data Center";
  vendors: { name: string; model: string }[];
}

function categorize(gbps: number): Result["category"] {
  if (gbps < 1) return "Entry-Level";
  if (gbps <= 5) return "Mid-Range";
  return "High-End / Data Center";
}

function suggestVendors(category: Result["category"]) {
  const map: Record<Result["category"], { name: string; model: string }[]> = {
    "Entry-Level": [
      { name: "Fortinet", model: "FortiGate 60F / 80F" },
      { name: "Palo Alto Networks", model: "PA-410 / PA-440" },
      { name: "Cisco", model: "Firepower 1010" },
      { name: "Sophos", model: "XGS 116 / 126" },
      { name: "Huawei", model: "USG6510E" },
    ],
    "Mid-Range": [
      { name: "Fortinet", model: "FortiGate 100F / 200F" },
      { name: "Palo Alto Networks", model: "PA-1410 / PA-3410" },
      { name: "Cisco", model: "Firepower 2110 / 2130" },
      { name: "Sophos", model: "XGS 3100 / 4300" },
      { name: "Huawei", model: "USG6620E" },
    ],
    "High-End / Data Center": [
      { name: "Fortinet", model: "FortiGate 600F / 1800F" },
      { name: "Palo Alto Networks", model: "PA-5410 / PA-5430" },
      { name: "Cisco", model: "Firepower 4112 / 4115" },
      { name: "Sophos", model: "XGS 6500 / 7500" },
      { name: "Huawei", model: "USG12000 series" },
    ],
  };
  return map[category];
}

function computeResult(form: FormState): Result {
  const totalBandwidth = form.isps.reduce((s, i) => s + (Number(i.bandwidth) || 0), 0);
  const featureSum = form.features.reduce(
    (acc, id) => acc + (FEATURES.find((f) => f.id === id)?.multiplier ?? 0),
    0
  );
  const userLoad = 1 + (Number(form.users) || 0) / 100 * 0.1;
  const growth = 1 + Number(form.growth) / 100;
  const haFactor = form.ha ? 1.0 : 1.0; // HA does not increase throughput requirement
  const siemFactor = form.siem ? 1.05 : 1.0;
  const required = totalBandwidth * (1 + featureSum) * userLoad * growth * haFactor * siemFactor;
  const gbps = required / 1000;
  const category = categorize(gbps);
  return {
    totalBandwidth,
    throughputMbps: required,
    throughputGbps: gbps,
    category,
    vendors: suggestVendors(category),
  };
}

export const FirewallSizingTool = () => {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);

  const totalBandwidth = useMemo(
    () => form.isps.reduce((s, i) => s + (Number(i.bandwidth) || 0), 0),
    [form.isps]
  );

  const livePreview = useMemo(() => {
    if (!totalBandwidth) return null;
    return computeResult(form);
  }, [form, totalBandwidth]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const updateISP = (id: string, patch: Partial<ISP>) => {
    setForm((f) => ({ ...f, isps: f.isps.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    setErrors((e) => ({ ...e, isps: "" }));
  };

  const addISP = () =>
    setForm((f) => ({ ...f, isps: [...f.isps, newISP(`ISP ${f.isps.length + 1}`, "")] }));

  const removeISP = (id: string) =>
    setForm((f) => ({ ...f, isps: f.isps.filter((i) => i.id !== id) }));

  const toggleFeature = (id: string, checked: boolean) =>
    setForm((f) => ({
      ...f,
      features: checked ? [...f.features, id] : f.features.filter((x) => x !== id),
    }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.users || Number(form.users) <= 0) e.users = "Enter a valid number of users";
    if (form.isps.length === 0) e.isps = "Add at least one ISP";
    const hasInvalidIsp = form.isps.some((i) => !i.bandwidth || Number(i.bandwidth) <= 0);
    if (hasInvalidIsp) e.isps = "Each ISP needs a bandwidth > 0";
    const ifaces =
      Number(form.oneG || 0) + Number(form.tenG || 0) + Number(form.twentyFiveG || 0);
    if (ifaces <= 0) e.oneG = "Specify at least one interface";
    if (form.features.length === 0) e.features = "Select at least one feature";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const calculate = () => {
    if (!validate()) {
      toast({
        title: "Please review the form",
        description: "Some fields need your attention.",
        variant: "destructive",
      });
      return;
    }
    const r = computeResult(form);
    setResult(r);
    setTimeout(
      () => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      100
    );
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
      `Total Users: ${form.users}`,
      `ISPs: ${form.isps.map((i) => `${i.name} (${i.bandwidth} Mbps)`).join(", ")}`,
      `Total Bandwidth: ${result.totalBandwidth} Mbps`,
      `Interfaces: 1G=${form.oneG || 0}, 10G=${form.tenG || 0}, 25G=${form.twentyFiveG || 0} (${form.media})`,
      `Features: ${form.features.map((id) => FEATURES.find((f) => f.id === id)?.label).join(", ")}`,
      `Growth: ${form.growth}%   HA: ${form.ha ? "Yes" : "No"}   SIEM: ${form.siem ? "Yes" : "No"}`,
    ];
    lines.forEach((l) => {
      doc.text(doc.splitTextToSize(l, W - 28), 14, y);
      y += 6 * Math.max(1, doc.splitTextToSize(l, W - 28).length);
    });

    y += 4;
    doc.setFontSize(13);
    doc.text("Result", 14, y); y += 7;
    doc.setFontSize(11);
    doc.text(`Estimated Throughput: ${result.throughputMbps.toFixed(0)} Mbps (${result.throughputGbps.toFixed(2)} Gbps)`, 14, y); y += 7;
    doc.text(`Recommended Category: ${result.category}`, 14, y); y += 9;

    doc.setFontSize(13);
    doc.text("Vendor Recommendations", 14, y); y += 7;
    doc.setFontSize(10);
    result.vendors.forEach((v) => {
      doc.text(`• ${v.name} — ${v.model}`, 16, y);
      y += 6;
    });

    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(90);
    const note = "Note: Final model selection should be validated against vendor datasheets with all security services enabled.";
    doc.text(doc.splitTextToSize(note, W - 28), 14, y);

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
          <header className="text-center mb-10 animate-fade-in-up">
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
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Users */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <SectionTitle icon={Users} title="Network Users" />
                <Label className="text-sm font-medium">Total Users</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 250"
                  value={form.users}
                  onChange={(e) => update("users", e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Each user may have multiple devices</p>
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
                    <div
                      key={isp.id}
                      className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg border border-border/60 bg-background/40"
                    >
                      <div className="col-span-12 sm:col-span-6">
                        <Label className="text-xs text-muted-foreground">ISP Name</Label>
                        <Input
                          placeholder={`ISP ${idx + 1}`}
                          value={isp.name}
                          onChange={(e) => updateISP(isp.id, { name: e.target.value })}
                          maxLength={60}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-5">
                        <Label className="text-xs text-muted-foreground">Bandwidth (Mbps)</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 500"
                          value={isp.bandwidth}
                          onChange={(e) => updateISP(isp.id, { bandwidth: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-end justify-end h-full">
                        <Button
                          variant="ghost"
                          size="icon"
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
                  <span className="text-base font-bold text-primary">
                    {totalBandwidth.toLocaleString()} Mbps
                  </span>
                </div>
              </Card>

              {/* Interfaces & Media */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <SectionTitle icon={Network} title="Interfaces" />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "oneG" as const, label: "1G" },
                    { key: "tenG" as const, label: "10G" },
                    { key: "twentyFiveG" as const, label: "25G" },
                  ].map((i) => (
                    <div key={i.key}>
                      <Label className="text-xs text-muted-foreground">{i.label} Interfaces</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={form[i.key]}
                        onChange={(e) => update(i.key, e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  ))}
                </div>
                {fieldError("oneG")}
                <div className="mt-4">
                  <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                    <Cable className="h-4 w-4 text-primary" /> Interface Media Type
                  </Label>
                  <Select value={form.media} onValueChange={(v) => update("media", v as MediaType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="copper">Copper</SelectItem>
                      <SelectItem value="sfp">SFP</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {/* Security Features */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <SectionTitle icon={Lock} title="Security Features" />
                <div className="space-y-4">
                  {CATEGORIES.map((cat) => (
                    <div key={cat}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {cat}
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {FEATURES.filter((f) => f.category === cat).map((f) => {
                          const checked = form.features.includes(f.id);
                          const Icon = f.icon;
                          return (
                            <Tooltip key={f.id}>
                              <TooltipTrigger asChild>
                                <label
                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    checked
                                      ? "border-primary bg-accent/50 shadow-sm"
                                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                                  }`}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => toggleFeature(f.id, !!v)}
                                  />
                                  <Icon className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium flex-1">{f.label}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {f.base ? `×1.${f.multiplier * 10}` : `+${f.multiplier}`}
                                  </span>
                                </label>
                              </TooltipTrigger>
                              <TooltipContent>{f.tooltip}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {fieldError("features")}
              </Card>

              {/* Growth & Toggles */}
              <Card className="bg-gradient-card shadow-card border-border/60 p-5 sm:p-6 animate-fade-in-up">
                <SectionTitle icon={TrendingUp} title="Growth & Operations" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Expected Growth</Label>
                    <Select value={form.growth} onValueChange={(v) => update("growth", v as Growth)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No growth</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="100">100%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <ToggleRow
                      label="High Availability (HA)"
                      desc="Deploy as active/passive or active/active pair"
                      checked={form.ha}
                      onChange={(v) => update("ha", v)}
                    />
                    <ToggleRow
                      label="Enable Logging / SIEM"
                      desc="Forward logs to SIEM (≈5% overhead)"
                      checked={form.siem}
                      onChange={(v) => update("siem", v)}
                    />
                  </div>
                </div>
              </Card>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={calculate}
                  size="lg"
                  className="flex-1 bg-gradient-hero hover:opacity-95 shadow-elevated text-primary-foreground"
                >
                  <Calculator className="h-4 w-4" /> Calculate Sizing
                </Button>
                <Button onClick={reset} size="lg" variant="outline">
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              </div>
            </div>

            {/* Sidebar live preview */}
            <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
              <Card className="bg-gradient-result border-primary/20 shadow-card p-5 animate-fade-in-up">
                <div className="flex items-center gap-2 text-primary mb-3">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Live Preview</span>
                </div>
                {livePreview ? (
                  <div className="space-y-3">
                    <Stat label="Total Bandwidth" value={`${livePreview.totalBandwidth.toLocaleString()} Mbps`} />
                    <Stat
                      label="Required Throughput"
                      value={`${livePreview.throughputGbps.toFixed(2)} Gbps`}
                      accent
                    />
                    <Stat label="Category" value={livePreview.category} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enter ISP bandwidth to see a live estimate.
                  </p>
                )}
              </Card>
            </aside>
          </div>

          {/* Result */}
          {result && (
            <Card
              id="result"
              className="mt-10 p-6 sm:p-8 bg-gradient-result border-primary/20 shadow-elevated animate-scale-in"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Sizing Result</span>
                </div>
                <Button onClick={exportPDF} variant="outline" size="sm">
                  <FileDown className="h-4 w-4" /> Export PDF
                </Button>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <ResultStat
                  label="Total ISP Bandwidth"
                  value={`${result.totalBandwidth.toLocaleString()}`}
                  unit="Mbps"
                />
                <ResultStat
                  label="Required Throughput"
                  value={result.throughputGbps.toFixed(2)}
                  unit="Gbps"
                  highlight
                  sub={`${result.throughputMbps.toFixed(0)} Mbps`}
                />
                <ResultStat label="Category" value={result.category} />
              </div>

              <div className="mt-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Server className="h-4 w-4 text-primary" /> Vendor Recommendations
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.vendors.map((v) => (
                    <div
                      key={v.name}
                      className="p-4 rounded-lg bg-card border border-border/60 hover:border-primary/40 hover:shadow-card transition-all"
                    >
                      <div className="text-sm font-semibold">{v.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{v.model}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-6 italic border-t border-border/50 pt-4">
                Final model selection should be validated against vendor datasheets with all security services enabled.
              </p>
            </Card>
          )}

          <footer className="text-center text-xs text-muted-foreground mt-10">
            Built for network architects · Generic across Fortinet, Palo Alto, Cisco, Sophos & Huawei
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
};

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

const ToggleRow = ({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/60">
    <div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);
