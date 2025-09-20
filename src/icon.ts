// WebSig logo - A minimal, beautiful icon inspired by biometric authentication
// This is a fingerprint-inspired circular design with gradient
export const WEBSIG_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="websig-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667EEA;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764BA2;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="2" result="offsetblur"/>
      <feFlood flood-color="#000000" flood-opacity="0.1"/>
      <feComposite in2="offsetblur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background circle with gradient -->
  <circle cx="64" cy="64" r="60" fill="url(#websig-gradient)" filter="url(#shadow)"/>
  
  <!-- Biometric/fingerprint pattern -->
  <g opacity="0.9">
    <!-- Central dot -->
    <circle cx="64" cy="64" r="4" fill="white"/>
    
    <!-- Concentric arcs representing fingerprint -->
    <path d="M 44 64 Q 64 44, 84 64" stroke="white" stroke-width="2" fill="none" opacity="0.8"/>
    <path d="M 39 64 Q 64 39, 89 64" stroke="white" stroke-width="2" fill="none" opacity="0.6"/>
    <path d="M 34 64 Q 64 34, 94 64" stroke="white" stroke-width="2" fill="none" opacity="0.4"/>
    
    <!-- Lower arcs -->
    <path d="M 44 64 Q 64 84, 84 64" stroke="white" stroke-width="2" fill="none" opacity="0.8"/>
    <path d="M 39 64 Q 64 89, 89 64" stroke="white" stroke-width="2" fill="none" opacity="0.6"/>
    <path d="M 34 64 Q 64 94, 94 64" stroke="white" stroke-width="2" fill="none" opacity="0.4"/>
    
    <!-- Side elements for tech feel -->
    <circle cx="44" cy="64" r="2" fill="white" opacity="0.7"/>
    <circle cx="84" cy="64" r="2" fill="white" opacity="0.7"/>
  </g>
  
  <!-- Subtle glow effect -->
  <circle cx="64" cy="64" r="58" stroke="white" stroke-width="1" fill="none" opacity="0.2"/>
</svg>
`).toString('base64')}`;
