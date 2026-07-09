import { useState } from "react";
import { useNavigate } from "react-router";

const slides = [
    {
        id: 0,
        illustrationBg: "#12172a",
        illustration: "briefing",
        title: "Your day, briefed in seconds",
        subtitle:
            "Ryve scans your calendar, inbox, and tasks every morning — so you always know what matters most.",
    },
    {
        id: 1,
        illustrationBg: "#0f1a14",
        illustration: "tasks",
        title: "Tasks that track themselves",
        subtitle:
            "Priorities auto-ranked, deadlines flagged, and progress tracked — without you lifting a finger.",
    },
    {
        id: 2,
        illustrationBg: "#1a0f1a",
        illustration: "team",
        title: "Lead your team with clarity",
        subtitle:
            "Delegate tasks, track team workloads, and get AI-generated weekly reports — all in one place.",
    },
];

const BriefingIllustration = () => (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", gap: 8 }}>
            {[
                { label: "Meetings", value: "3" },
                { label: "Emails", value: "12" },
                { label: "Tasks", value: "4" },
            ].map((s) => (
                <div key={s.label} style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, borderRadius: 8, padding: "6px 8px", background: "#1a1d2e" }}>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 500, marginLeft: "auto" }}>{s.value}</span>
                </div>
            ))}
        </div>
        <div style={{ width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 40, background: "rgba(255,107,26,.13)", border: "1.5px solid rgba(255,107,26,.35)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff6b1a" strokeWidth="1.5">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="4" x2="12" y2="7" />
                <line x1="12" y1="17" x2="12" y2="20" />
                <line x1="4" y1="12" x2="7" y2="12" />
                <line x1="17" y1="12" x2="20" y2="12" />
            </svg>
        </div>
    </div>
);

const TasksIllustration = () => {
    const tasks = [
        { label: "Review Q3 analytics report", color: "#34d399", icon: "✅" },
        { label: "Send client proposal by 3 PM", color: "#34d399", icon: "✅" },
        { label: "Follow up with design team", color: "#fbbf24", icon: "🕐" },
        { label: "Weekly insight summary", color: "#4b5563", icon: "⭕" },
    ];
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: "100%", padding: "0 24px" }}>
            {tasks.map((t) => (
                <div key={t.label} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, padding: "10px 12px", background: "#1a1d2e", color: t.color, fontSize: 13 }}>
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                </div>
            ))}
        </div>
    );
};

const TeamIllustration = () => {
    const members = [
        { initials: "JD", bg: "rgba(255,107,26,.2)", color: "#ff6b1a" },
        { initials: "MR", bg: "rgba(52,211,153,.2)", color: "#34d399" },
        { initials: "SK", bg: "rgba(167,139,250,.2)", color: "#a78bfa" },
        { initials: "AL", bg: "rgba(96,165,250,.2)", color: "#60a5fa" },
        { initials: "PK", bg: "rgba(251,146,60,.2)", color: "#fb923c" },
    ];
    return (
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, width: "100%", height: "100%" }}>
            <div style={{ position: "absolute", top: 16, right: 16, borderRadius: 8, padding: "4px 10px", fontSize: 12, background: "rgba(167,139,250,.15)", color: "#a78bfa" }}>
                ✦ AI powered
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {members.map((m) => (
                    <div key={m.initials} style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, background: m.bg, color: m.color }}>
                        {m.initials}
                    </div>
                ))}
            </div>
            <div style={{ width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(167,139,250,.13)", border: "1.5px solid rgba(167,139,250,.35)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
                    <circle cx="9" cy="7" r="3" />
                    <circle cx="15" cy="7" r="3" />
                    <path d="M3 20c0-4 2.7-7 6-7h6c3.3 0 6 3 6 7" />
                </svg>
            </div>
        </div>
    );
};

export default function OnboardingSlider() {
    const [current, setCurrent] = useState(0);
    const navigate = useNavigate();
    const total = slides.length;

    const goTo = (index: number) => setCurrent(index);

   const handleNext = () => {
  if (current < total - 1) {
    goTo(current + 1);
  } else {
    localStorage.setItem('hasSeenOnboarding', 'true'); // ✅ add this
    navigate("/register");
  }
};

const handleSkip = () => {
  localStorage.setItem('hasSeenOnboarding', 'true'); // ✅ add this
  navigate("/login");
};
    

    let touchStartX = 0;
    const onTouchStart = (e: React.TouchEvent) => {
        touchStartX = e.touches[0].clientX;
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx < -40 && current < total - 1) goTo(current + 1);
        if (dx > 40 && current > 0) goTo(current - 1);
    };

    const slide = slides[current];

    const renderIllustration = () => {
        if (slide.illustration === "briefing") return <BriefingIllustration />;
        if (slide.illustration === "tasks") return <TasksIllustration />;
        if (slide.illustration === "team") return <TeamIllustration />;
        return null;
    };

    return (
        <div
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{
                display: "flex",
                flexDirection: "column",
                width: "100vw",
                height: "100dvh",
                background: "#0d0f1a",
                overflow: "hidden",
                position: "fixed",
                top: 0,
                left: 0,
            }}
        >
            {/* Illustration area */}
            <div
                style={{
                    background: slide.illustrationBg,
                    height: "52%",
                    flexShrink: 0,
                    transition: "background 0.4s ease",
                    position: "relative",
                }}
            >
                {renderIllustration()}
            </div>

            {/* Copy */}
            <div style={{ padding: "24px 24px 8px" }}>
                <h2 style={{ color: "#ffffff", fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
                    {slide.title}
                </h2>
                <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
                    {slide.subtitle}
                </p>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px 40px", marginTop: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Dots */}
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            style={{
                                height: 6,
                                width: i === current ? 22 : 6,
                                borderRadius: i === current ? 4 : "50%",
                                background: i === current ? "#ff6b1a" : "#2d3154",
                                border: "none",
                                transition: "all 0.3s ease",
                                cursor: "pointer",
                                padding: 0,
                            }}
                        />
                    ))}
                </div>

                {/* Nav buttons */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button
                        onClick={handleSkip}
                        style={{ color: "#4b5563", background: "none", border: "none", fontSize: 14, cursor: "pointer" }}
                    >
                        {current === total - 1 ? "Sign in" : "Skip"}
                    </button>
                    <button
                        onClick={handleNext}
                        style={{ background: "#ff6b1a", border: "none", borderRadius: 50, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                    >
                        {current === total - 1 ? "Get started" : "Next"}
                    </button>
                </div>
            </div>
        </div>
    );
}