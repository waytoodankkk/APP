// ========================== IconComponents.tsx (v2.5 – Lucide Edition, all-safe) ==========================
import {
  Home,
  Menu,
  User,
  Users,
  Layers,
  Film,
  Sparkles,
  Trash2,
  Pencil,
  Plus,
  Play,
  Download,
  Upload,
  Key,
  Info,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Camera,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  CircleCheck,
  Cog,
  Maximize,
  Minimize,
  Settings,
} from "lucide-react";

// ==================================================
// ✅ Base replacements
// ==================================================
export const HomeIcon = Home;
export const MenuIcon = Menu;
export const UserIcon = User;
export const UsersIcon = Users;
export const LayersIcon = Layers;
export const FilmIcon = Film;
export const SparklesIcon = Sparkles;
export const TrashIcon = Trash2;
export const PencilIcon = Pencil;
export const PlusIcon = Plus;
export const PlayIcon = Play;
export const DownloadIcon = Download;
export const UploadIcon = Upload;
export const KeyIcon = Key;
export const InfoIcon = Info;
export const ChatIcon = MessageCircle;
export const PaperClipIcon = Paperclip;
export const PhotoIcon = Camera;
export const CopyIcon = Copy;
export const RefreshIcon = RefreshCw;
export const AlertIcon = AlertCircle;
export const CheckIcon = CheckCircle2;
export const XCircleIcon = XCircle;
export const ArrowUpIcon = ArrowUp;
export const ArrowDownIcon = ArrowDown;
export const ArrowRightIcon = ArrowRight;
export const ArrowLeftIcon = ArrowLeft;
export const CogIcon = Cog;
export const SettingsIcon = Settings;

// ==================================================
// 🧩 Compatibility aliases (for old components)
// ==================================================
export const UserCircleIcon = User; // ✅ for GeminiPlayground / old header avatar
export const ArrowsPointingOutIcon = Maximize;
export const CheckCircleIcon = CircleCheck;
export const ChatBubbleLeftRightIcon = MessageSquare;
export const Cog6ToothIcon = Cog;
export const ArrowPathIcon = RefreshCw;
export const DocumentDuplicateIcon = Copy;
export const ArrowUpTrayIcon = Upload;
export const ArrowDownTrayIcon = Download;
export const PhotoIconAlias = Camera;
export const InformationCircleIcon = Info;
export const RectangleStackIcon = Layers;
export const PaperAirplaneIcon = ArrowUp;
export const LayersAlias = Layers;

// ==================================================
// 🔁 Universal fallbacks (ensures no missing imports)
// ==================================================
export const RefreshCWIcon = RefreshCw;
export const UploadTrayIcon = Upload;
export const DownloadTrayIcon = Download;
export const WarningIcon = AlertCircle;
export const SuccessIcon = CircleCheck;
export const ErrorIcon = XCircle;
export const MessageIcon = MessageSquare;
export const FullscreenIcon = Maximize;
export const CollapseIcon = Minimize;

// ==================================================
// 🆕 NEW ICONS FOR CHROME AUTHENTICATION
// ==================================================

// ==================================================
// 🆕 NEW ICONS FOR CHROME AUTHENTICATION (UPDATED)
// ==================================================

// Chrome Icon - Replaced with Globe from lucide-react for consistency
import { Globe } from "lucide-react";

export const ChromeIcon = ({ className }: { className?: string }) => (
  <Globe className={className} />
);