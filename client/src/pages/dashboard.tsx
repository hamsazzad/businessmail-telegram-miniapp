import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getTelegramUser, initTelegramApp, hapticFeedback, hapticNotification, isTelegramContext } from "@/lib/telegram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Coins, Copy, RefreshCw, CheckCircle2, Clock, Timer,
  ExternalLink, Gift, CalendarCheck, Tv, Shield, ChevronRight, ChevronDown,
  Inbox, Send, Plus, Settings, Users, Zap, Trash2, Megaphone,
  Search, Gem, Diamond, MinusCircle, MessageCircle, X, SendHorizontal
} from "lucide-react";
import { SiTelegram } from "react-icons/si";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DOMPurify from "dompurify";

const ADMIN_ID = "7151673318";
const CHANNEL = "@aamoviesofficial";

const AD_DIRECT_LINK = "https://summonteacherjunction.com/r03qsx6f?key=2fb4e5433393716e58400d771b255afb";
const AD_POPUNDER_SCRIPT = "https://summonteacherjunction.com/e2/5b/7a/e25b7a7d319c7998d0efd502126b96d1.js";
const AD_SOCIAL_BAR_SCRIPT = "https://summonteacherjunction.com/56/a9/60/56a9606e2ca47ee386b86030681636fe.js";
const AD_NATIVE_BANNER_SCRIPT = "https://summonteacherjunction.com/2fefd24338557e95e105e90dd8c412e3/invoke.js";
const AD_NATIVE_CONTAINER_ID = "container-2fefd24338557e95e105e90dd8c412e3";

function formatTimeRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function formatDaysRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function sanitizeEmailHtml(html: string): string {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'table', 'tr',
      'td', 'th', 'thead', 'tbody', 'img', 'hr', 'blockquote', 'pre', 'code',
      'center', 'font', 'small', 'big', 'sub', 'sup'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'style', 'class', 'width', 'height', 'align',
      'valign', 'border', 'cellpadding', 'cellspacing', 'bgcolor', 'color',
      'size', 'face', 'target', 'rel'
    ],
    ALLOW_DATA_ATTR: false,
  });
  DOMPurify.removeHook('afterSanitizeAttributes');
  return clean;
}

function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function loadAdScript(src: string, container?: HTMLElement): HTMLScriptElement {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  if (container) {
    container.appendChild(script);
  } else {
    document.body.appendChild(script);
  }
  return script;
}

function cleanupAdScripts() {
  document.querySelectorAll('script[src*="summonteacherjunction"]').forEach(el => {
    try { el.remove(); } catch {}
  });
  document.querySelectorAll('iframe[src*="summonteacherjunction"], iframe[src*="adsterra"], div[id*="container-2fefd"]').forEach(el => {
    try { el.remove(); } catch {}
  });
}

export default function Dashboard() {
  const { toast } = useToast();
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(10);
  const [adComplete, setAdComplete] = useState(false);
  const [gemAdModalOpen, setGemAdModalOpen] = useState(false);
  const [gemAdTimer, setGemAdTimer] = useState(10);
  const [gemAdComplete, setGemAdComplete] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createEmailOpen, setCreateEmailOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [useSubdomain, setUseSubdomain] = useState(false);
  const [selectedEmailIdx, setSelectedEmailIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("emails");
  const [emailSelectorOpen, setEmailSelectorOpen] = useState(false);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const gemAdContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initTelegramApp();
    const user = getTelegramUser();
    if (user) {
      setTelegramUser(user);
    } else {
      setTelegramUser({ id: 12345678, first_name: "Demo", username: "demo_user" });
    }
  }, []);

  const userId = String(telegramUser?.id || "");

  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await apiRequest("POST", "/api/auth", {
        telegramId: userId,
        username: telegramUser?.username,
        firstName: telegramUser?.first_name,
      });
      return res.json();
    },
    enabled: !!userId,
  });

  const user = authData?.user;
  const emails = authData?.emails || [];
  const userIsAdmin = authData?.isAdmin || userId === ADMIN_ID;
  const appSettings = authData?.settings || {};

  const generateEmailMut = useMutation({
    mutationFn: async (params?: { customName?: string; subdomain?: string }) => {
      const res = await apiRequest("POST", "/api/generate-email", {
        telegramId: userId,
        customName: params?.customName || undefined,
        subdomain: params?.subdomain || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      hapticNotification("success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      toast({ title: "Email Generated!", description: "Your temporary email is ready." });
      setCreateEmailOpen(false);
      setCustomName("");
      setSubdomain("");
      setUseSubdomain(false);
    },
    onError: (err: any) => {
      const msg = String(err.message || "Could not create email");
      if (msg.includes("join") || msg.includes("Join") || msg.includes("channel") || msg.includes("403")) {
        toast({ title: "Join Channel Required", description: "You must join @aamoviesofficial to create emails. Opening channel now...", variant: "destructive" });
        setTimeout(() => window.open("https://t.me/aamoviesofficial", "_blank"), 500);
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    },
  });

  const deleteEmailMut = useMutation({
    mutationFn: async (emailId: number) => {
      const res = await apiRequest("DELETE", `/api/delete-email/${emailId}`, { telegramId: userId });
      return res.json();
    },
    onSuccess: () => {
      hapticNotification("success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      toast({ title: "Email Deleted", description: "You can create a new one." });
      setSelectedEmailIdx(0);
    },
  });

  const activeEmail = emails.length > 0 ? emails[selectedEmailIdx] || emails[0] : null;

  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: ["/api/inbox", activeEmail?.emailAddress],
    queryFn: async () => {
      const res = await fetch(`/api/inbox/${activeEmail.emailAddress}`);
      return res.json();
    },
    enabled: !!activeEmail?.emailAddress,
    refetchInterval: 10000,
  });

  const verifyJoinMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/verify-join", { telegramId: userId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      if (data.already_claimed) {
        toast({ title: "Already Claimed", description: "You've already received the join reward." });
      } else if (data.joined) {
        hapticNotification("success");
        toast({ title: "Reward Claimed!", description: `+${data.reward} tokens added!` });
      } else {
        hapticNotification("warning");
        toast({ title: "Not a Member", description: "Please join the channel first.", variant: "destructive" });
      }
    },
  });

  const checkinMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/daily-checkin", { telegramId: userId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      if (data.already_checked_in) {
        toast({ title: "Already Checked In", description: "Come back tomorrow!" });
      } else {
        hapticNotification("success");
        toast({ title: "Check-in Complete!", description: `+${data.reward} tokens earned!` });
      }
    },
  });

  const adRewardMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reward-ad", { telegramId: userId });
      return res.json();
    },
    onSuccess: (data) => {
      hapticNotification("success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      toast({
        title: "Tokens Earned!",
        description: `+${data.reward} tokens from watching ad!`,
      });
      setAdModalOpen(false);
      setAdTimer(10);
      setAdComplete(false);
    },
  });

  const gemAdRewardMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reward-gem-ad", { telegramId: userId });
      return res.json();
    },
    onSuccess: (data) => {
      hapticNotification("success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      toast({
        title: "Gems Earned!",
        description: `+${data.gemsEarned} gems from watching ad!`,
      });
      setGemAdModalOpen(false);
      setGemAdTimer(10);
      setGemAdComplete(false);
    },
  });

  const extendMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/extend-limit", {
        telegramId: userId,
        emailId: activeEmail?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      hapticNotification("success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      const extDays = appSettings.extension_days || "2";
      toast({ title: "Extended!", description: `Email lifespan extended by ${extDays} days.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Not enough tokens", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!adModalOpen || adComplete) return;
    if (adTimer <= 0) {
      setAdComplete(true);
      return;
    }
    const interval = setInterval(() => setAdTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [adModalOpen, adTimer, adComplete]);

  useEffect(() => {
    if (!gemAdModalOpen || gemAdComplete) return;
    if (gemAdTimer <= 0) {
      setGemAdComplete(true);
      return;
    }
    const interval = setInterval(() => setGemAdTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [gemAdModalOpen, gemAdTimer, gemAdComplete]);

  useEffect(() => {
    if (adModalOpen && adContainerRef.current) {
      const container = adContainerRef.current;
      container.innerHTML = "";
      loadAdScript(AD_SOCIAL_BAR_SCRIPT);
      const nativeDiv = document.createElement("div");
      nativeDiv.id = AD_NATIVE_CONTAINER_ID;
      container.appendChild(nativeDiv);
      const nativeScript = document.createElement("script");
      nativeScript.async = true;
      nativeScript.setAttribute("data-cfasync", "false");
      nativeScript.src = AD_NATIVE_BANNER_SCRIPT;
      container.appendChild(nativeScript);
    }
    if (!adModalOpen) {
      cleanupAdScripts();
      if (adContainerRef.current) {
        adContainerRef.current.innerHTML = "";
      }
    }
  }, [adModalOpen]);

  useEffect(() => {
    if (gemAdModalOpen && gemAdContainerRef.current) {
      const container = gemAdContainerRef.current;
      container.innerHTML = "";
      loadAdScript(AD_SOCIAL_BAR_SCRIPT);
      const nativeDiv = document.createElement("div");
      nativeDiv.id = AD_NATIVE_CONTAINER_ID + "-gem";
      container.appendChild(nativeDiv);
      const nativeScript = document.createElement("script");
      nativeScript.async = true;
      nativeScript.setAttribute("data-cfasync", "false");
      nativeScript.src = AD_NATIVE_BANNER_SCRIPT;
      container.appendChild(nativeScript);
    }
    if (!gemAdModalOpen) {
      cleanupAdScripts();
      if (gemAdContainerRef.current) {
        gemAdContainerRef.current.innerHTML = "";
      }
    }
  }, [gemAdModalOpen]);

  const openAdModal = useCallback(() => {
    window.open(AD_DIRECT_LINK, "_blank", "noopener,noreferrer");
    loadAdScript(AD_POPUNDER_SCRIPT);
    setAdTimer(10);
    setAdComplete(false);
    setAdModalOpen(true);
    hapticFeedback("medium");
  }, []);

  const openGemAdModal = useCallback(() => {
    window.open(AD_DIRECT_LINK, "_blank", "noopener,noreferrer");
    loadAdScript(AD_POPUNDER_SCRIPT);
    setGemAdTimer(10);
    setGemAdComplete(false);
    setGemAdModalOpen(true);
    hapticFeedback("medium");
  }, []);

  const copyEmail = useCallback(() => {
    if (activeEmail?.emailAddress) {
      navigator.clipboard.writeText(activeEmail.emailAddress);
      setCopied(true);
      hapticFeedback("medium");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeEmail]);

  const isAdmin = userIsAdmin;
  const inboxEmails = inboxData?.emails || [];
  const today = new Date().toISOString().split("T")[0];
  const alreadyCheckedIn = user?.lastCheckinDate === today;

  const userGems = user?.gems || 0;
  const gemBonus = Math.floor(userGems);
  const globalMaxEmails = parseInt(appSettings.max_emails_per_user || "10");
  const userMaxEmails = user?.maxEmails !== null && user?.maxEmails !== undefined ? user.maxEmails : globalMaxEmails;
  const effectiveMaxEmails = userMaxEmails + gemBonus;
  const extensionCost = parseInt(appSettings.extension_cost || "10");
  const extensionDays = parseInt(appSettings.extension_days || "2");

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Loading BusinessMail...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background px-4 pt-6 pb-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg" data-testid="avatar">
              {user.firstName?.[0] || "U"}
            </div>
            <div>
              <p className="font-semibold text-sm" data-testid="text-username">{user.firstName || "User"}</p>
              <p className="text-xs text-muted-foreground">@{user.username || telegramUser?.username || "user"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button size="icon" variant="ghost" onClick={() => setAdminPanelOpen(true)} data-testid="button-admin">
                <Shield className="w-4 h-4" />
              </Button>
            )}
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5" data-testid="badge-gems">
              <Diamond className="w-3.5 h-3.5 text-cyan-500" />
              <span className="font-bold">{userGems.toFixed(1)}</span>
            </Badge>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5" data-testid="badge-tokens">
              <Coins className="w-3.5 h-3.5 text-yellow-500" />
              <span className="font-bold">{user.tokens}</span>
            </Badge>
          </div>
        </div>

        {!activeEmail ? (
          <Card className="border-dashed border-2" data-testid="card-generate-email">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold mb-1">No Active Email</p>
                <p className="text-sm text-muted-foreground">Create a temporary email to get started</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button onClick={() => generateEmailMut.mutate({})} disabled={generateEmailMut.isPending} data-testid="button-generate-email">
                  <Zap className="w-4 h-4 mr-2" />
                  {generateEmailMut.isPending ? "Generating..." : "Random Email"}
                </Button>
                <Button variant="outline" onClick={() => setCreateEmailOpen(true)} data-testid="button-custom-email">
                  <Plus className="w-4 h-4 mr-2" />
                  Custom Email
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="card-active-email">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {emails.length > 1 ? `Email ${selectedEmailIdx + 1}/${emails.length}` : "Active Email"}
                  </span>
                </div>
                <Badge variant="outline" className="gap-1 text-xs shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatDaysRemaining(activeEmail.expiresAt)}
                </Badge>
              </div>

              {emails.length > 1 && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs h-9"
                    onClick={() => setEmailSelectorOpen(!emailSelectorOpen)}
                    data-testid="button-email-selector"
                  >
                    <span className="truncate font-mono">{activeEmail.emailAddress}</span>
                    <ChevronDown className={`w-3.5 h-3.5 ml-2 shrink-0 transition-transform ${emailSelectorOpen ? "rotate-180" : ""}`} />
                  </Button>
                  {emailSelectorOpen && (
                    <Card className="absolute z-50 w-full mt-1 shadow-lg border">
                      <ScrollArea className="max-h-[200px]">
                        <div className="p-1">
                          {emails.map((e: any, idx: number) => (
                            <button
                              key={e.id}
                              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                                idx === selectedEmailIdx
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted"
                              }`}
                              onClick={() => {
                                setSelectedEmailIdx(idx);
                                setEmailSelectorOpen(false);
                                hapticFeedback("light");
                              }}
                              data-testid={`option-email-${idx}`}
                            >
                              <span className="font-mono truncate block">{e.emailAddress}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDaysRemaining(e.expiresAt)}</span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  )}
                </div>
              )}

              {emails.length <= 1 && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-muted/50 px-3 py-2 rounded-md truncate" data-testid="text-email-address">
                    {activeEmail.emailAddress}
                  </code>
                  <Button size="icon" variant="secondary" onClick={copyEmail} data-testid="button-copy-email">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              {emails.length > 1 && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-muted/50 px-3 py-2 rounded-md truncate" data-testid="text-email-address">
                    {activeEmail.emailAddress}
                  </code>
                  <Button size="icon" variant="secondary" onClick={copyEmail} data-testid="button-copy-email">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => extendMut.mutate()}
                  disabled={extendMut.isPending || (!isAdmin && user.tokens < extensionCost)}
                  data-testid="button-extend-email"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Extend +{extensionDays}d
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateEmailOpen(true)}
                  data-testid="button-add-email"
                >
                  <Plus className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteEmailMut.mutate(activeEmail.id)}
                  disabled={deleteEmailMut.isPending}
                  data-testid="button-delete-email"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
                    hapticFeedback("light");
                  }}
                  data-testid="button-refresh-inbox"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="px-4 -mt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3" data-testid="tabs-main">
            <TabsTrigger value="emails" className="gap-1.5" data-testid="tab-emails">
              <Mail className="w-3.5 h-3.5" />
              My Emails
              {emails.length > 0 && (
                <Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px] min-w-[18px] h-[18px] flex items-center justify-center">
                  {emails.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-1.5" data-testid="tab-inbox">
              <Inbox className="w-3.5 h-3.5" />
              Inbox
              {inboxEmails.length > 0 && (
                <Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px] min-w-[18px] h-[18px] flex items-center justify-center">
                  {inboxEmails.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="earn" className="gap-1.5" data-testid="tab-earn">
              <Coins className="w-3.5 h-3.5" />
              Earn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emails" className="mt-4 space-y-3" data-testid="emails-content">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground">
                {emails.length}/{effectiveMaxEmails} emails used
                {gemBonus > 0 && <span className="text-cyan-500 ml-1">(+{gemBonus} gem bonus)</span>}
              </p>
            </div>
            {emails.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-medium text-sm">No Emails Yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create your first temporary email above</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {emails.map((email: any, idx: number) => (
                    <Card
                      key={email.id}
                      className={`cursor-pointer hover-elevate ${idx === selectedEmailIdx ? "ring-2 ring-primary/30" : ""}`}
                      data-testid={`card-my-email-${email.id}`}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${idx === selectedEmailIdx ? "bg-primary/15" : "bg-muted"}`}>
                            <Mail className={`w-4 h-4 ${idx === selectedEmailIdx ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono truncate" data-testid={`text-my-email-addr-${email.id}`}>
                              {email.emailAddress}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDaysRemaining(email.expiresAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant={idx === selectedEmailIdx ? "default" : "secondary"}
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmailIdx(idx);
                                setActiveTab("inbox");
                                hapticFeedback("light");
                              }}
                              data-testid={`button-view-inbox-${email.id}`}
                            >
                              <Inbox className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(email.emailAddress);
                                hapticFeedback("medium");
                                toast({ title: "Copied!", description: email.emailAddress });
                              }}
                              data-testid={`button-copy-my-email-${email.id}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEmailMut.mutate(email.id);
                              }}
                              disabled={deleteEmailMut.isPending}
                              data-testid={`button-delete-my-email-${email.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="inbox" className="mt-4 space-y-3" data-testid="inbox-content">
            {activeEmail && emails.length > 1 && (
              <div className="mb-2">
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-mono"
                  value={selectedEmailIdx}
                  onChange={(e) => {
                    setSelectedEmailIdx(parseInt(e.target.value));
                    hapticFeedback("light");
                  }}
                  data-testid="select-inbox-email"
                >
                  {emails.map((e: any, idx: number) => (
                    <option key={e.id} value={idx}>{e.emailAddress}</option>
                  ))}
                </select>
              </div>
            )}
            {activeEmail && (
              <div className="flex items-center gap-2 px-1 mb-2">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground truncate">
                  Viewing inbox for <span className="font-mono font-medium text-foreground">{activeEmail.emailAddress}</span>
                </p>
              </div>
            )}
            {!activeEmail ? (
              <div className="text-center py-12 space-y-3">
                <Mail className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Generate an email first to see your inbox</p>
              </div>
            ) : inboxLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="py-4">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : inboxEmails.length === 0 ? (
              <div className="text-center py-12 space-y-3" data-testid="empty-inbox">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                  <Inbox className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-medium text-sm">Inbox is Empty</p>
                  <p className="text-xs text-muted-foreground mt-1">Emails sent to your address will appear here</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
                    hapticFeedback("light");
                  }}
                  data-testid="button-refresh-inbox-empty"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Refresh
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {inboxEmails.map((email: any) => (
                    <EmailCard key={email.id} email={email} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="earn" className="mt-4 space-y-3" data-testid="earn-content">
            <Card className="hover-elevate" data-testid="card-join-channel">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <SiTelegram className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Join Channel</p>
                    <p className="text-xs text-muted-foreground">Join {CHANNEL} to earn tokens</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">+20</Badge>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(`https://t.me/${CHANNEL.replace("@", "")}`, "_blank")}
                    data-testid="button-open-channel"
                  >
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Open Channel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => verifyJoinMut.mutate()}
                    disabled={verifyJoinMut.isPending || user.joinRewardClaimed}
                    data-testid="button-verify-join"
                  >
                    {user.joinRewardClaimed ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1.5" /> Claimed</>
                    ) : verifyJoinMut.isPending ? (
                      "Checking..."
                    ) : (
                      <><Gift className="w-3 h-3 mr-1.5" /> Verify & Claim</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-daily-checkin">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <CalendarCheck className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Daily Check-in</p>
                    <p className="text-xs text-muted-foreground">Come back every day for free tokens</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">+6</Badge>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => checkinMut.mutate()}
                  disabled={checkinMut.isPending || alreadyCheckedIn}
                  data-testid="button-daily-checkin"
                >
                  {alreadyCheckedIn ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1.5" /> Checked In Today</>
                  ) : checkinMut.isPending ? (
                    "Checking in..."
                  ) : (
                    <><Gift className="w-3 h-3 mr-1.5" /> Check In Now</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-watch-token-ad">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Tv className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Watch Token Ad</p>
                    <p className="text-xs text-muted-foreground">Watch an ad to earn tokens</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">+{appSettings.ad_reward_tokens || "20"} tokens</Badge>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-3"
                  onClick={openAdModal}
                  data-testid="button-watch-token-ad"
                >
                  <Coins className="w-3 h-3 mr-1.5 text-yellow-500" />
                  Watch Ad — Earn Tokens
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate border-cyan-200/30" data-testid="card-watch-gem-ad">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Diamond className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Watch Gem Ad</p>
                    <p className="text-xs text-muted-foreground">Watch an ad to earn gems</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-cyan-600 border-cyan-200">+{appSettings.gem_per_ad || "0.2"} gem</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                  onClick={openGemAdModal}
                  data-testid="button-watch-gem-ad"
                >
                  <Diamond className="w-3 h-3 mr-1.5 text-cyan-500" />
                  Watch Ad — Earn Gems
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border-cyan-200/30" data-testid="card-gem-info">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Diamond className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Gem System</p>
                    <p className="text-xs text-muted-foreground">1 Gem = 1 extra email slot</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Your Gems</span>
                    <span className="font-bold text-cyan-600">{userGems.toFixed(1)}</span>
                  </div>
                  <Progress value={(userGems % 1) * 100} className="h-2" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{Math.ceil((1 - (userGems % 1)) / parseFloat(appSettings.gem_per_ad || "0.2"))} ads to next gem</span>
                    <span>{gemBonus} bonus slots active</span>
                  </div>
                  {userGems >= 1 && (
                    <p className="text-[10px] text-cyan-600 font-medium">
                      Your {gemBonus} gem(s) give you {gemBonus} extra email slot(s) automatically!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator className="my-2" />

            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">Token Balance</p>
              <p className="text-2xl font-bold" data-testid="text-token-balance">{user.tokens}</p>
              <p className="text-xs text-muted-foreground">Use tokens to extend email lifespan ({extensionCost} tokens = +{extensionDays} days)</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={adModalOpen} onOpenChange={(open) => { if (!open && !adComplete) return; setAdModalOpen(open); }}>
        <DialogContent className="max-w-sm" data-testid="modal-token-ad">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              Watch Ad — Earn Tokens
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              ref={adContainerRef}
              className="w-full min-h-[120px] bg-muted rounded-lg overflow-hidden flex flex-col items-center justify-center"
              id="adModal"
              data-testid="token-ad-container"
            >
              <p className="text-xs text-muted-foreground p-4 text-center">Loading ads...</p>
            </div>

            {!adComplete ? (
              <div className="text-center space-y-3 w-full">
                <div className="flex items-center justify-center gap-2">
                  <Timer className="w-4 h-4 text-primary" />
                  <span className="text-2xl font-bold font-mono" data-testid="text-token-ad-timer">{adTimer}</span>
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
                <Progress value={((10 - adTimer) / 10) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">Please wait for the timer to complete</p>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={() => adRewardMut.mutate()}
                disabled={adRewardMut.isPending}
                data-testid="button-claim-token-reward"
              >
                <Coins className="w-4 h-4 mr-2 text-yellow-500" />
                {adRewardMut.isPending ? "Claiming..." : `Claim ${appSettings.ad_reward_tokens || "20"} Tokens`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gemAdModalOpen} onOpenChange={(open) => { if (!open && !gemAdComplete) return; setGemAdModalOpen(open); }}>
        <DialogContent className="max-w-sm" data-testid="modal-gem-ad">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Diamond className="w-5 h-5 text-cyan-500" />
              Watch Ad — Earn Gems
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              ref={gemAdContainerRef}
              className="w-full min-h-[120px] bg-muted rounded-lg overflow-hidden flex flex-col items-center justify-center"
              id="gemAdModal"
              data-testid="gem-ad-container"
            >
              <p className="text-xs text-muted-foreground p-4 text-center">Loading ads...</p>
            </div>

            {!gemAdComplete ? (
              <div className="text-center space-y-3 w-full">
                <div className="flex items-center justify-center gap-2">
                  <Timer className="w-4 h-4 text-cyan-500" />
                  <span className="text-2xl font-bold font-mono" data-testid="text-gem-ad-timer">{gemAdTimer}</span>
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
                <Progress value={((10 - gemAdTimer) / 10) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">Please wait for the timer to complete</p>
              </div>
            ) : (
              <Button
                className="w-full border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                variant="outline"
                onClick={() => gemAdRewardMut.mutate()}
                disabled={gemAdRewardMut.isPending}
                data-testid="button-claim-gem-reward"
              >
                <Diamond className="w-4 h-4 mr-2 text-cyan-500" />
                {gemAdRewardMut.isPending ? "Claiming..." : `Claim ${appSettings.gem_per_ad || "0.2"} Gems`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createEmailOpen} onOpenChange={setCreateEmailOpen}>
        <DialogContent className="max-w-sm" data-testid="modal-create-email">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Create Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Email slots: {emails.length}/{effectiveMaxEmails}
              {gemBonus > 0 && <span className="text-cyan-500 ml-1">(+{gemBonus} from gems)</span>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Email Name</Label>
              <Input
                placeholder="e.g. jdvijay (leave empty for random)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                data-testid="input-custom-name"
              />
              <p className="text-[10px] text-muted-foreground">2-30 characters: letters, numbers, dots, hyphens</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-subdomain"
                  checked={useSubdomain}
                  onChange={(e) => { setUseSubdomain(e.target.checked); if (!e.target.checked) setSubdomain(""); }}
                  className="rounded"
                  data-testid="checkbox-subdomain"
                />
                <Label htmlFor="use-subdomain" className="text-xs cursor-pointer">Use custom subdomain</Label>
              </div>
              {useSubdomain && (
                <Input
                  placeholder="e.g. shsshobuj"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  data-testid="input-subdomain"
                />
              )}
            </div>

            <Card>
              <CardContent className="py-3">
                <p className="text-[10px] text-muted-foreground mb-1">Preview</p>
                <code className="text-sm font-mono break-all" data-testid="text-email-preview">
                  {(customName || "random")}@{useSubdomain && subdomain ? `${subdomain}.` : ""}filmcity.online
                </code>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  generateEmailMut.mutate({
                    customName: customName || undefined,
                    subdomain: useSubdomain && subdomain ? subdomain : undefined,
                  });
                }}
                disabled={generateEmailMut.isPending}
                data-testid="button-create-email-submit"
              >
                {generateEmailMut.isPending ? "Creating..." : "Create Email"}
              </Button>
              <Button variant="outline" onClick={() => setCreateEmailOpen(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <AdminPanel open={adminPanelOpen} onClose={() => setAdminPanelOpen(false)} userId={userId} />
      )}

      <ChatBubble />
    </div>
  );
}

function EmailCard({ email }: { email: any }) {
  const [expanded, setExpanded] = useState(false);
  const receivedDate = new Date(email.receivedAt).toLocaleString();
  const bodyIsHtml = isHtmlContent(email.body || "");

  return (
    <Card
      className="cursor-pointer hover-elevate"
      onClick={() => setExpanded(!expanded)}
      data-testid={`card-email-${email.id}`}
    >
      <CardContent className="py-3 space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Send className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" data-testid={`text-email-subject-${email.id}`}>
              {email.subject}
            </p>
            <p className="text-xs text-muted-foreground truncate">{email.fromAddress}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{receivedDate}</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
        {expanded && (
          <div className="pt-2 border-t">
            {bodyIsHtml ? (
              <div
                className="email-body-rendered text-sm overflow-x-auto max-w-full"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.body) }}
                data-testid={`text-email-body-${email.id}`}
              />
            ) : (
              <pre
                className="text-xs whitespace-pre-wrap break-words text-muted-foreground max-h-60 overflow-auto"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                data-testid={`text-email-body-${email.id}`}
              >
                {email.body || "(Empty body)"}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminPanel({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const { toast } = useToast();
  const [adminTab, setAdminTab] = useState("overview");
  const [giftTelegramId, setGiftTelegramId] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [giftMode, setGiftMode] = useState<"add" | "deduct">("add");
  const [gemGiftTelegramId, setGemGiftTelegramId] = useState("");
  const [gemGiftAmount, setGemGiftAmount] = useState("");
  const [gemGiftMode, setGemGiftMode] = useState<"add" | "deduct">("add");
  const [massGiftAmount, setMassGiftAmount] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userLimitEmails, setUserLimitEmails] = useState("");
  const [userLimitDays, setUserLimitDays] = useState("");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/admin/stats", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stats?adminId=${userId}`);
      return res.json();
    },
    enabled: open,
  });

  const { data: usersData } = useQuery({
    queryKey: ["/api/admin/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?adminId=${userId}`);
      return res.json();
    },
    enabled: open && (adminTab === "users" || adminTab === "tools"),
  });

  const setupTelegramMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/setup/telegram-webhook", { adminId: userId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Telegram webhook configured!" });
    },
  });

  const deployWorkerMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/setup/deploy-worker", { adminId: userId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.success ? "Worker Deployed!" : "Error", description: data.success ? "Cloudflare worker is live." : "Check logs for details." });
    },
  });

  const deployGithubMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/setup/deploy-github", { adminId: userId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "GitHub Deployed!" : "Info",
        description: data.success ? `Pages URL: ${data.pagesUrl}` : data.message || "Check logs.",
      });
    },
  });

  const updateSettingMut = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("POST", "/api/admin/settings", { adminId: userId, key, value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth"] });
      toast({ title: "Setting Updated" });
    },
  });

  const giftTokensMut = useMutation({
    mutationFn: async () => {
      const amount = giftMode === "deduct" ? -Math.abs(parseInt(giftAmount)) : Math.abs(parseInt(giftAmount));
      const res = await apiRequest("POST", "/api/admin/gift-tokens", {
        adminId: userId,
        telegramId: giftTelegramId,
        amount,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      const action = giftMode === "deduct" ? "deducted from" : "sent to";
      toast({ title: "Success!", description: `${giftAmount} tokens ${action} ${giftTelegramId}` });
      setGiftTelegramId("");
      setGiftAmount("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    },
  });

  const giftGemsMut = useMutation({
    mutationFn: async () => {
      const amount = gemGiftMode === "deduct" ? -Math.abs(parseFloat(gemGiftAmount)) : Math.abs(parseFloat(gemGiftAmount));
      const res = await apiRequest("POST", "/api/admin/gift-gems", {
        adminId: userId,
        telegramId: gemGiftTelegramId,
        amount,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      const action = gemGiftMode === "deduct" ? "deducted from" : "sent to";
      toast({ title: "Success!", description: `${gemGiftAmount} gems ${action} ${gemGiftTelegramId}` });
      setGemGiftTelegramId("");
      setGemGiftAmount("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    },
  });

  const massGiftMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/gift-all", {
        adminId: userId,
        amount: massGiftAmount,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Mass Gift Sent!", description: `${massGiftAmount} tokens gifted to ${data.count} users` });
      setMassGiftAmount("");
    },
  });

  const setUserLimitsMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/set-user-limits", {
        adminId: userId,
        telegramId: selectedUser?.telegramId,
        maxEmails: userLimitEmails === "" ? null : userLimitEmails,
        maxEmailDays: userLimitDays === "" ? null : userLimitDays,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Limits Updated" });
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    },
  });

  const broadcastMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/broadcast", {
        adminId: userId,
        message: broadcastMsg,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Broadcast Sent!", description: `Sent to ${data.sent} users (${data.failed} failed)` });
      setBroadcastMsg("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Broadcast failed", variant: "destructive" });
    },
  });

  const allUsers = usersData?.users || [];
  const filteredUsers = userSearch
    ? allUsers.filter((u: any) =>
        u.telegramId.includes(userSearch) ||
        (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.firstName && u.firstName.toLowerCase().includes(userSearch.toLowerCase()))
      )
    : allUsers;

  const settingLabels: Record<string, string> = {
    default_email_days: "Email Lifetime (days)",
    ad_reward_tokens: "Ad Reward Tokens",
    extension_cost: "Extension Cost (tokens)",
    join_reward_tokens: "Join Reward Tokens",
    checkin_tokens: "Check-in Tokens",
    extension_days: "Extension Duration (days)",
    extension_limit: "Extension Limit (times)",
    max_emails_per_user: "Max Emails Per User",
    gem_per_ad: "Gems Per Ad Watch",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid="modal-admin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Admin Panel
          </DialogTitle>
        </DialogHeader>

        <Tabs value={adminTab} onValueChange={setAdminTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="overview" className="text-xs" data-testid="admin-tab-overview">Stats</TabsTrigger>
            <TabsTrigger value="users" className="text-xs" data-testid="admin-tab-users">Users</TabsTrigger>
            <TabsTrigger value="tools" className="text-xs" data-testid="admin-tab-tools">Tools</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs" data-testid="admin-tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-3">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading stats...</div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Card>
                    <CardContent className="py-3 text-center">
                      <Users className="w-4 h-4 mx-auto text-primary mb-1" />
                      <p className="text-lg font-bold" data-testid="text-total-users">{stats.totalUsers}</p>
                      <p className="text-[10px] text-muted-foreground">Users</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3 text-center">
                      <Coins className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
                      <p className="text-lg font-bold" data-testid="text-total-tokens">{stats.totalTokens}</p>
                      <p className="text-[10px] text-muted-foreground">Tokens</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3 text-center">
                      <Diamond className="w-4 h-4 mx-auto text-cyan-500 mb-1" />
                      <p className="text-lg font-bold" data-testid="text-total-gems">{stats.totalGems}</p>
                      <p className="text-[10px] text-muted-foreground">Gems</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3 text-center">
                      <SiTelegram className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                      <p className="text-lg font-bold" data-testid="text-channel-members">{stats.channelMembers}</p>
                      <p className="text-[10px] text-muted-foreground">Members</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Deployment</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setupTelegramMut.mutate()}
                    disabled={setupTelegramMut.isPending}
                    data-testid="button-setup-telegram"
                  >
                    <SiTelegram className="w-3 h-3 mr-2" />
                    {setupTelegramMut.isPending ? "Setting up..." : "Setup Telegram Webhook"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => deployWorkerMut.mutate()}
                    disabled={deployWorkerMut.isPending}
                    data-testid="button-deploy-worker"
                  >
                    <Zap className="w-3 h-3 mr-2" />
                    {deployWorkerMut.isPending ? "Deploying..." : "Deploy Cloudflare Email Worker"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => deployGithubMut.mutate()}
                    disabled={deployGithubMut.isPending}
                    data-testid="button-deploy-github"
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    {deployGithubMut.isPending ? "Deploying..." : "Deploy to GitHub Pages"}
                  </Button>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="users" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or ID"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
                data-testid="input-user-search"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {filteredUsers.map((u: any) => (
                  <Card
                    key={u.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setSelectedUser(u);
                      setUserLimitEmails(u.maxEmails !== null && u.maxEmails !== undefined ? String(u.maxEmails) : "");
                      setUserLimitDays(u.maxEmailDays !== null && u.maxEmailDays !== undefined ? String(u.maxEmailDays) : "");
                    }}
                    data-testid={`card-user-${u.telegramId}`}
                  >
                    <CardContent className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{u.firstName || u.username || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground">ID: {u.telegramId}</p>
                          {(u.maxEmails !== null || u.maxEmailDays !== null) && (
                            <p className="text-[10px] text-cyan-600">
                              Custom: {u.maxEmails !== null ? `${u.maxEmails} emails` : ""}{u.maxEmails !== null && u.maxEmailDays !== null ? ", " : ""}{u.maxEmailDays !== null ? `${u.maxEmailDays}d` : ""}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-yellow-500" />
                            <span className="text-xs font-bold">{u.tokens}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Diamond className="w-3 h-3 text-cyan-500" />
                            <span className="text-xs">{(u.gems || 0).toFixed(1)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{u.activeEmails} emails</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No users found</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4 mt-3">
            <Card>
              <CardContent className="py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Add/Deduct Tokens</p>
                </div>
                <div className="flex gap-1 mb-2">
                  <Button
                    size="sm"
                    variant={giftMode === "add" ? "default" : "outline"}
                    className="flex-1 h-7 text-xs"
                    onClick={() => setGiftMode("add")}
                    data-testid="button-gift-mode-add"
                  >
                    <Gift className="w-3 h-3 mr-1" /> Add
                  </Button>
                  <Button
                    size="sm"
                    variant={giftMode === "deduct" ? "destructive" : "outline"}
                    className="flex-1 h-7 text-xs"
                    onClick={() => setGiftMode("deduct")}
                    data-testid="button-gift-mode-deduct"
                  >
                    <MinusCircle className="w-3 h-3 mr-1" /> Deduct
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Telegram ID"
                    value={giftTelegramId}
                    onChange={(e) => setGiftTelegramId(e.target.value)}
                    className="h-8 text-xs"
                    data-testid="input-gift-telegram-id"
                  />
                  <Input
                    placeholder="Amount"
                    type="number"
                    value={giftAmount}
                    onChange={(e) => setGiftAmount(e.target.value)}
                    className="h-8 text-xs w-24"
                    data-testid="input-gift-amount"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  variant={giftMode === "deduct" ? "destructive" : "default"}
                  onClick={() => giftTokensMut.mutate()}
                  disabled={giftTokensMut.isPending || !giftTelegramId || !giftAmount}
                  data-testid="button-gift-tokens"
                >
                  {giftTokensMut.isPending ? "Processing..." : giftMode === "deduct" ? "Deduct Tokens" : "Gift Tokens"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Diamond className="w-4 h-4 text-cyan-500" />
                  <p className="text-sm font-medium">Add/Deduct Gems</p>
                </div>
                <div className="flex gap-1 mb-2">
                  <Button
                    size="sm"
                    variant={gemGiftMode === "add" ? "default" : "outline"}
                    className="flex-1 h-7 text-xs"
                    onClick={() => setGemGiftMode("add")}
                    data-testid="button-gem-mode-add"
                  >
                    <Diamond className="w-3 h-3 mr-1" /> Add
                  </Button>
                  <Button
                    size="sm"
                    variant={gemGiftMode === "deduct" ? "destructive" : "outline"}
                    className="flex-1 h-7 text-xs"
                    onClick={() => setGemGiftMode("deduct")}
                    data-testid="button-gem-mode-deduct"
                  >
                    <MinusCircle className="w-3 h-3 mr-1" /> Deduct
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Telegram ID"
                    value={gemGiftTelegramId}
                    onChange={(e) => setGemGiftTelegramId(e.target.value)}
                    className="h-8 text-xs"
                    data-testid="input-gem-gift-telegram-id"
                  />
                  <Input
                    placeholder="Amount"
                    type="number"
                    step="0.1"
                    value={gemGiftAmount}
                    onChange={(e) => setGemGiftAmount(e.target.value)}
                    className="h-8 text-xs w-24"
                    data-testid="input-gem-gift-amount"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  variant={gemGiftMode === "deduct" ? "destructive" : "default"}
                  onClick={() => giftGemsMut.mutate()}
                  disabled={giftGemsMut.isPending || !gemGiftTelegramId || !gemGiftAmount}
                  data-testid="button-gift-gems"
                >
                  {giftGemsMut.isPending ? "Processing..." : gemGiftMode === "deduct" ? "Deduct Gems" : "Gift Gems"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  <p className="text-sm font-medium">Mass Gift to All Users</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Tokens per user"
                    type="number"
                    value={massGiftAmount}
                    onChange={(e) => setMassGiftAmount(e.target.value)}
                    className="h-8 text-xs"
                    data-testid="input-mass-gift-amount"
                  />
                  <Button
                    size="sm"
                    onClick={() => massGiftMut.mutate()}
                    disabled={massGiftMut.isPending || !massGiftAmount}
                    data-testid="button-mass-gift"
                  >
                    {massGiftMut.isPending ? "Sending..." : "Send to All"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-medium">Broadcast Message</p>
                </div>
                <Textarea
                  placeholder="Type your broadcast message (HTML supported)..."
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  className="text-xs min-h-[80px]"
                  data-testid="textarea-broadcast"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => broadcastMut.mutate()}
                  disabled={broadcastMut.isPending || !broadcastMsg.trim()}
                  data-testid="button-broadcast"
                >
                  <Megaphone className="w-3 h-3 mr-1.5" />
                  {broadcastMut.isPending ? "Sending..." : "Send Broadcast"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-3 mt-3">
            <p className="text-xs font-medium text-muted-foreground">Global Settings (apply to all users unless overridden)</p>
            {stats?.settings && Object.entries(stats.settings).map(([key, value]: [string, any]) => (
              <div key={key} className="flex items-center gap-2">
                <Label className="text-xs flex-1 truncate">{settingLabels[key] || key.replace(/_/g, " ")}</Label>
                <Input
                  className="w-24 h-8 text-xs"
                  defaultValue={value}
                  onBlur={(e) => {
                    if (e.target.value !== value) {
                      updateSettingMut.mutate({ key, value: e.target.value });
                    }
                  }}
                  data-testid={`input-setting-${key}`}
                />
              </div>
            ))}
            {!stats?.settings && (
              <p className="text-xs text-muted-foreground text-center py-6">Loading settings...</p>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedUser} onOpenChange={(o) => { if (!o) setSelectedUser(null); }}>
          <DialogContent className="max-w-sm" data-testid="modal-user-limits">
            <DialogHeader>
              <DialogTitle className="text-sm">
                User: {selectedUser?.firstName || selectedUser?.username || selectedUser?.telegramId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                <p>ID: {selectedUser?.telegramId}</p>
                <p>Tokens: {selectedUser?.tokens} | Gems: {(selectedUser?.gems || 0).toFixed(1)}</p>
                <p>Active Emails: {selectedUser?.activeEmails}</p>
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-medium">Individual Restrictions</p>
                <p className="text-[10px] text-muted-foreground">Leave blank to use global settings</p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs flex-1">Max Emails</Label>
                  <Input
                    className="w-20 h-8 text-xs"
                    type="number"
                    placeholder="Global"
                    value={userLimitEmails}
                    onChange={(e) => setUserLimitEmails(e.target.value)}
                    data-testid="input-user-max-emails"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs flex-1">Email Valid (days)</Label>
                  <Input
                    className="w-20 h-8 text-xs"
                    type="number"
                    placeholder="Global"
                    value={userLimitDays}
                    onChange={(e) => setUserLimitDays(e.target.value)}
                    data-testid="input-user-max-days"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setUserLimitsMut.mutate()}
                  disabled={setUserLimitsMut.isPending}
                  data-testid="button-save-user-limits"
                >
                  {setUserLimitsMut.isPending ? "Saving..." : "Save Restrictions"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Hi! I'm your BusinessMail Assistant. Ask me anything about the app — how to earn tokens, gems, create emails, and more!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I couldn't process that. Please try again." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); hapticFeedback("light"); }}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          data-testid="button-chat-bubble"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-80 h-[420px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden" data-testid="chat-panel">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium text-sm">BusinessMail Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
              data-testid="button-close-chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            data-testid="chat-messages"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                  data-testid={`chat-msg-${idx}`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2 text-xs text-muted-foreground">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder="Ask me anything..."
              className="flex-1 h-9 px-3 rounded-full border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={loading}
              data-testid="input-chat-message"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors"
              data-testid="button-send-chat"
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
