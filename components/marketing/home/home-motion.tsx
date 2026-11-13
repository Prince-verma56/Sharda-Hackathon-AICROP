'use client';

/**
 * All home page motion in one place (GSAP + ScrollTrigger, driven by the app's Lenis
 * smooth scroll). Markup opts in with data attributes, so sections stay server components.
 * Content is fully visible without JS or with prefers-reduced-motion.
 */
import { useEffect, useLayoutEffect } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion, registerGsapPlugins } from '@/animations/core';
import { usePathname } from 'next/navigation';
import { usePreloader } from '@/components/preloader/preloader-provider';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function HomeMotion() {
  const { isPreloaderComplete } = usePreloader();
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    if (!isPreloaderComplete || prefersReducedMotion()) return;
    registerGsapPlugins();

    const ctx = gsap.context(() => {
      const q = <T extends Element = HTMLElement>(selector: string) => gsap.utils.toArray<T>(selector);
      const has = (selector: string) => document.querySelector(selector) !== null;

      // ---- Hero intro (single timeline) ------------------------------------------
      if (has('[data-hero-title]')) {
      const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
      intro
        .from('[data-hero-word]', { yPercent: 115, rotate: 2, duration: 1.25, stagger: 0.09 }, 0.05)
        // clip-path keeps the pill's reserved size, so the headline never reflows mid-animation
        .fromTo(
          '[data-hero-pill]',
          { clipPath: 'inset(0% 50% 0% 50% round 999px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 999px)', duration: 1.2, ease: 'expo.inOut' },
          0.25,
        )
        .from('[data-hero-pill-image]', { scale: 1.6, duration: 1.6, ease: 'power3.out' }, 0.3)
        .from('[data-hero-fade]', { opacity: 0, y: 14, duration: 0.9, stagger: 0.1 }, 0.55)
        .from('[data-hero-dot]', { scale: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(3)' }, 0.75)
        .fromTo(
          '[data-hero-card]',
          { clipPath: 'inset(18% 6% 0% 6% round 28px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.5, ease: 'expo.inOut' },
          0.35,
        )
        .from('[data-hero-card-image]', { scale: 1.22, duration: 2, ease: 'power3.out' }, 0.35)
        .from('[data-hero-card-label]', { opacity: 0, y: -10, duration: 0.7 }, 1.15)
        .from('[data-hero-chip]', { opacity: 0, y: 24, scale: 0.92, duration: 0.8, stagger: 0.1 }, 1.2)
        .from('[data-hero-copy]', { opacity: 0, y: 16, duration: 0.8 }, 1.35)
        .from('[data-hero-cta] > *', { opacity: 0, y: 16, duration: 0.8, stagger: 0.08 }, 1.4)
        .from('[data-feature-item]', { opacity: 0, y: 20, duration: 0.8, stagger: 0.07 }, 1.5);

      // Dots keep a quiet sequential pulse after the intro.
      gsap.to('[data-hero-dot]', {
        opacity: 0.35,
        duration: 0.8,
        stagger: { each: 0.25, repeat: -1, yoyo: true },
        ease: 'sine.inOut',
        delay: 2.4,
      });

      // Scroll: headline drifts up and the card gently compresses, tied to scroll position.
      gsap.to('[data-hero-title]', {
        yPercent: -18,
        opacity: 0.6,
        ease: 'none',
        scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true },
      });
      gsap.to('[data-hero-card]', {
        scale: 0.965,
        ease: 'none',
        scrollTrigger: { trigger: '[data-hero-card]', start: 'top 20%', end: 'bottom top', scrub: true },
      });
      }

      // ---- Parallax ---------------------------------------------------------------
      q('[data-parallax]').forEach((element) => {
        const speed = Number(element.dataset.parallax) || 0.15;
        gsap.fromTo(
          element,
          { yPercent: -speed * 40 },
          {
            yPercent: speed * 40,
            ease: 'none',
            scrollTrigger: { trigger: element.parentElement ?? element, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });

      // ---- Reveal on scroll -------------------------------------------------------
      const reveals = q('[data-reveal]').filter((el) => !el.closest('#top'));
      reveals.forEach((element) =>
        gsap.set(element, element.dataset.reveal === 'scale' ? { opacity: 0, y: 40, scale: 0.97 } : { opacity: 0, y: 32 }),
      );
      ScrollTrigger.batch(reveals, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power3.out', stagger: 0.12, overwrite: true }),
      });

      // ---- How it works -----------------------------------------------------------
      if (has('[data-step]')) {
      gsap.set('[data-step]', { opacity: 0, y: 40 });
      ScrollTrigger.batch('[data-step]', {
        start: 'top 85%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.18 }),
      });
      gsap.from('[data-line-draw]', {
        scaleX: 0,
        duration: 1.4,
        ease: 'power2.inOut',
        scrollTrigger: { trigger: '[data-line-draw]', start: 'top 82%', once: true },
      });
      }

      // ---- Count-up stats ---------------------------------------------------------
      q('[data-count]').forEach((element) => {
        const target = Number(element.dataset.count);
        const counter = { value: 0 };
        element.textContent = '0';
        gsap.to(counter, {
          value: target,
          duration: 1.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: element, start: 'top 90%', once: true },
          onUpdate: () => {
            element.textContent = Math.round(counter.value).toString();
          },
        });
      });

      // ---- Crop tiles -------------------------------------------------------------
      if (has('[data-crop-tile]')) {
      gsap.set('[data-crop-tile]', { opacity: 0, y: 50 });
      ScrollTrigger.batch('[data-crop-tile]', {
        start: 'top 92%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.09 }),
      });
      }

      // ---- Ambient details --------------------------------------------------------
      if (has('[data-scan-frame]')) {
      gsap.fromTo('[data-scan-line]', { top: '4%' }, { top: '96%', duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.to('[data-float-card]', { y: -10, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.from('[data-scan-frame]', {
        opacity: 0,
        scale: 1.15,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '[data-scan-frame]', start: 'top 85%', once: true },
      });
      }

      q<SVGPathElement>('[data-draw]').forEach((path, index) => {
        const length = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: length, strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: 1.8,
            delay: index * 0.15,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: path.closest('section') ?? path, start: 'top 80%', once: true },
          },
        );
      });
    });

    // Images and fonts can shift layout slightly after first paint.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    const timer = window.setTimeout(refresh, 600);

    return () => {
      window.removeEventListener('load', refresh);
      window.clearTimeout(timer);
      ctx.revert();
    };
  }, [isPreloaderComplete, pathname]);

  return null;
}
