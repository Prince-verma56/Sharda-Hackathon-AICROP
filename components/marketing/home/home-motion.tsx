'use client';

/**
 * All home page motion in one place (GSAP + ScrollTrigger, driven by the app's Lenis
 * smooth scroll). Markup opts in with data attributes, so sections stay server components.
 * Content is fully visible without JS or with prefers-reduced-motion.
 */
import { useEffect, useLayoutEffect } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion, registerGsapPlugins } from '@/animations/core';
import { usePreloader } from '@/components/preloader/preloader-provider';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function HomeMotion() {
  const { isPreloaderComplete } = usePreloader();

  useIsomorphicLayoutEffect(() => {
    if (!isPreloaderComplete || prefersReducedMotion()) return;
    registerGsapPlugins();

    const ctx = gsap.context(() => {
      const q = <T extends Element = HTMLElement>(selector: string) => gsap.utils.toArray<T>(selector);

      // ---- Hero intro -------------------------------------------------------------
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from('[data-hero-media]', { opacity: 0, scale: 1.06, duration: 1.8, ease: 'power2.out' }, 0)
        .from('[data-hero-line]', { opacity: 0, y: 44, duration: 1.1, stagger: 0.12 }, 0.15)
        .from('[data-feature-strip]', { opacity: 0, y: 70, duration: 1.1 }, 0.55)
        .from('[data-feature-item]', { opacity: 0, y: 18, duration: 0.7, stagger: 0.08 }, 0.8);

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
      gsap.set('[data-crop-tile]', { opacity: 0, y: 50 });
      ScrollTrigger.batch('[data-crop-tile]', {
        start: 'top 92%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.09 }),
      });

      // ---- Ambient details --------------------------------------------------------
      gsap.fromTo('[data-scan-line]', { top: '4%' }, { top: '96%', duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.to('[data-float-card]', { y: -10, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.from('[data-scan-frame]', {
        opacity: 0,
        scale: 1.15,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '[data-scan-frame]', start: 'top 85%', once: true },
      });

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
  }, [isPreloaderComplete]);

  return null;
}
