import { useState } from "react";
import {
  Shield, Users, Globe, Gauge, Network, Cable, Lock, TrendingUp,
  Calculator, RotateCcw, ShieldCheck, Sparkles, AlertCircle, Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type MediaType = "copper" | "sfp" | "mixed";
type Growth = "0" | "20" | "50";
type Feature = "firewall" | "ips" | "ssl" | "vpn";

interface FormState {
  users: string;
  isps: string;
  bandwidth: string;
  oneG: string;
  tenG: string;
  twentyFiveG: string;
  media: MediaType;
  features: Feature[];
  growth: Growth;
}

const initialState: FormState = {
  users: "",
  isps: "",
  bandwidth: "",
  oneG: "",
  tenG: "",
  twentyFiveG: "",
  media: "copper",
  features: ["firewall"],
  growth: "0",
};

interface Result {
  throughput: number;
  category: "Entry-Level" | "Mid-Range" | "High-End";
  vendors: { name: string; model: string }[];
}

const FEATURES: { id: Feature; label: string; multiplier: number; desc: string }[] = [
  { id: "firewall", label: "Firewall only", multiplier: 1.2, desc: "Base stateful inspection" },
  { id: "ips", label: "IPS", multiplier: 1.5, desc: "Intrusion prevention" },
  { id: "ssl", label: "SSL Inspection", multiplier: 2.0, desc: "Decrypt TLS traffic" },
  { id: "vpn", label: "VPN", multiplier: 1.3, desc: "Site-to-site & remote access" },
];

function categorize(gbps: number): Result["category"] {
  if (gbps < 1) return "Entry-Level";
  if (gbps <= 5) return "Mid-Range";
  return "High-End";
}

function suggestVendors(category: Result["category"]) {
  const map = {
    "Entry-Level": [
      { name: "Fortinet", model: "FortiGate 60F / 80F" },
      { name: "Palo Alto", model: "PA-410 / PA-440" },
      { name: "Sophos", model: "XGS 116 / 126" },
      { name: "Cisco", model: "Firepower 1010" },
      { name: "Huawei", model: "USG6510E" },
    ],
    "Mid-Range": [
      { name: "Fortinet", model: "FortiGate 100F / 200F" },
      { name: "Palo Alto", model: "PA-1410 / PA-3410" },
      { name: "Sophos", model: "XGS 3100 / 4300" },
      { name: "Cisco", model: "Firepower 2110 / 2130" },
      { name: "Huawei", model: "USG6620E" },
    ],
    "High-End": [
      { name: "Fortinet", model: "FortiGate 600F / 1800F" },
      { name: "Palo Alto", model: "PA-5410 / PA-5430" },
      { name: "Sophos", model: "XGS 6500 / 7500" },
      { name: "Cisco", model: "Firepower 4112 / 4115" },
      { name: "Huawei", model: "USG12000 series" },
    ],
  };
  return map[category];
}

export const FirewallSizingTool = () => {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const toggleFeature = (id: Feature, checked: boolean) => {
    setForm((f) => ({
      ...f,
      features: checked ? [...f.features, id] : f.features.filter((x) => x !== id),
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const numFields: (keyof FormState)[] = ["users", "isps", "bandwidth"];
    numFields.forEach((k) => {
      const v = Number(form[k]);
      if (!form[k] || isNaN(v) || v <= 0) e[k] = "Required, must be > 0";
    });
    const ifaces = Number(form.oneG || 0) + Number(form.tenG || 0) + Number(form.twentyFiveG || 0);
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
    const bandwidth = Number(form.bandwidth);
    const multiplier = form.features.reduce(
      (acc, id) => acc * (FEATURES.find((f) => f.id === id)?.multiplier ?? 1),
      1
    );
    const growthFactor = 1 + Number(form.growth) / 100;
    const requiredMbps = bandwidth * multiplier * growthFactor;
    const gbps = requiredMbps / 1000;
    const category = categorize(gbps);
    setResult({
      throughput: gbps,
      category,
      vendors: suggestVendors(category),
    });
    setTimeout(() => {
      document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const reset = () => {
    setForm(initialState);
    setErrors({});
    setResult(null);
  };

  const fieldError = (key: string) =>
    errors[key] && (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" /> {errors[key]}
      </p>
    );

  return (
    <div className="min-h-screen px-4 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10 animate-fade-in-up">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-hero shadow-glow mb-5">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-hero bg-clip-text text-transparent">
            Firewall Sizing Tool
          </h1>
          <p className="text-muted-foreground mt-3 text-base sm:text-lg">
            Estimate the right firewall based on your network requirements
          </p>
        </header>

        {/* Form Card */}
        <Card className="bg-gradient-card shadow-card border-border/60 p-6 sm:p-8 animate-fade-in-up">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Users */}
            <div>
              <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" /> Total Users
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 250"
                value={form.users}
                onChange={(e) => update("users", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Each user may have multiple devices</p>
              {fieldError("users")}
            </div>

            {/* ISPs */}
            <div>
              <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Globe className="h-4 w-4 text-primary" /> Number of ISPs
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 2"
                value={form.isps}
                onChange={(e) => update("isps", e.target.value)}
              />
              {fieldError("isps")}
            </div>

            {/* Bandwidth */}
            <div className="sm:col-span-2">
              <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Gauge className="h-4 w-4 text-primary" /> Total Internet Bandwidth (Mbps)
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 1000"
                value={form.bandwidth}
                onChange={(e) => update("bandwidth", e.target.value)}
              />
              {fieldError("bandwidth")}
            </div>

            {/* Interfaces */}
            <div className="sm:col-span-2">
              <Label className="flex items-center gap-2 mb-3 text-sm font-medium">
                <Network className="h-4 w-4 text-primary" /> Interface Requirements
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "oneG" as const, label: "1G" },
                  { key: "tenG" as const, label: "10G" },
                  { key: "twentyFiveG" as const, label: "25G" },
                ].map((i) => (
                  <div key={i.key}>
                    <Input
                      type="number"
                      min="0"
                      placeholder={`# of ${i.label}`}
                      value={form[i.key]}
                      onChange={(e) => update(i.key, e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1 text-center">{i.label} interfaces</p>
                  </div>
                ))}
              </div>
              {fieldError("oneG")}
            </div>

            {/* Media */}
            <div>
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

            {/* Growth */}
            <div>
              <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" /> Expected Growth
              </Label>
              <Select value={form.growth} onValueChange={(v) => update("growth", v as Growth)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No growth</SelectItem>
                  <SelectItem value="20">20% growth</SelectItem>
                  <SelectItem value="50">50% growth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Features */}
            <div className="sm:col-span-2">
              <Label className="flex items-center gap-2 mb-3 text-sm font-medium">
                <Lock className="h-4 w-4 text-primary" /> Security Features
              </Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {FEATURES.map((f) => {
                  const checked = form.features.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        checked
                          ? "border-primary bg-accent/50 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleFeature(f.id, !!v)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">{f.label}</div>
                        <div className="text-xs text-muted-foreground">{f.desc} · ×{f.multiplier}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {fieldError("features")}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Button
              onClick={calculate}
              size="lg"
              className="flex-1 bg-gradient-hero hover:opacity-95 shadow-elevated text-primary-foreground"
            >
              <Calculator className="h-4 w-4" /> Calculate
            </Button>
            <Button onClick={reset} size="lg" variant="outline" className="sm:w-auto">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </div>
        </Card>

        {/* Result */}
        {result && (
          <Card
            id="result"
            className="mt-8 p-6 sm:p-8 bg-gradient-result border-primary/20 shadow-elevated animate-scale-in"
          >
            <div className="flex items-center gap-2 text-primary mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Sizing Result</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mt-4">
              <div className="p-5 rounded-xl bg-card border border-border/60 shadow-card">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Throughput</div>
                <div className="text-4xl font-bold mt-2 bg-gradient-hero bg-clip-text text-transparent">
                  {result.throughput.toFixed(2)} <span className="text-lg">Gbps</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  ≈ {(result.throughput * 1000).toFixed(0)} Mbps required
                </div>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border/60 shadow-card">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Recommended Category</div>
                <div className="flex items-center gap-2 mt-2">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                  <span className="text-3xl font-bold">{result.category}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Based on throughput, features & growth
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                <Server className="h-4 w-4 text-primary" /> Suggested Vendors & Models
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.vendors.map((v) => (
                  <div
                    key={v.name}
                    className="p-4 rounded-lg bg-card border border-border/60 hover:border-primary/40 hover:shadow-card transition-all"
                  >
                    <div className="text-sm font-semibold text-foreground">{v.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{v.model}</div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-6 italic">
              * Estimates only. Validate with vendor datasheets and a proper PoC for production deployments.
            </p>
          </Card>
        )}

        <footer className="text-center text-xs text-muted-foreground mt-10">
          Built for network architects · Tech & security oriented sizing
        </footer>
      </div>
    </div>
  );
};
