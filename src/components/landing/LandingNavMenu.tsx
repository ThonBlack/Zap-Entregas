"use client";

import { useEffect, useState } from "react";

export default function LandingNavMenu() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        document.body.style.overflow = menuOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [menuOpen]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add("visible");
                        observer.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
        );
        document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const close = () => setMenuOpen(false);

    return (
        <>
            <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
                <div className="container nav-inner">
                    <a href="/" className="nav-logo">
                        <img src="/zap-logo.png" alt="Zap Entregas" />
                        <span>
                            Zap <span className="text-gradient">Entregas</span>
                        </span>
                    </a>
                    <ul className="nav-links">
                        <li><a href="#features">Funcionalidades</a></li>
                        <li><a href="#how">Como Funciona</a></li>
                        <li><a href="#pricing">Planos</a></li>
                        <li><a href="/login">Entrar</a></li>
                    </ul>
                    <a href="/register" className="nav-cta">
                        Começar grátis
                    </a>
                    <button
                        className="nav-toggle"
                        aria-label="Menu"
                        onClick={() => setMenuOpen((v) => !v)}
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </nav>

            <div className={`mobile-menu ${menuOpen ? "active" : ""}`}>
                <ul>
                    <li><a href="#features" onClick={close}>Funcionalidades</a></li>
                    <li><a href="#how" onClick={close}>Como Funciona</a></li>
                    <li><a href="#pricing" onClick={close}>Planos</a></li>
                    <li><a href="/login" onClick={close}>Entrar</a></li>
                    <li><a href="/register" onClick={close}>Começar grátis</a></li>
                </ul>
            </div>
        </>
    );
}
