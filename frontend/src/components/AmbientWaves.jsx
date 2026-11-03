const AmbientWaves = () => (
  <svg
    className="ambient-wave-background"
    viewBox="0 0 1600 1000"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient id="ambient-wave-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" className="ambient-wave-stop-start" />
        <stop offset="50%" className="ambient-wave-stop-middle" />
        <stop offset="100%" className="ambient-wave-stop-end" />
      </linearGradient>
    </defs>
    <g id="ambient-wave-contours">
      <path d="M-120 128 C90 18 250 254 478 158 S830 80 1012 176 S1326 268 1720 82" />
      <path d="M-120 206 C114 92 286 324 518 230 S848 150 1036 244 S1364 332 1720 158" />
      <path d="M-120 288 C120 174 314 402 552 306 S878 228 1060 320 S1388 408 1720 236" />
      <path d="M-120 374 C132 254 342 490 582 392 S908 310 1094 402 S1410 496 1720 318" />
      <path d="M-120 466 C150 340 366 570 612 480 S936 396 1124 488 S1440 586 1720 408" />
      <path d="M-120 562 C160 432 386 662 642 570 S964 488 1152 578 S1466 676 1720 500" />
      <path d="M-120 660 C176 526 410 760 670 666 S992 582 1182 674 S1492 768 1720 590" />
      <path d="M-120 762 C196 622 432 854 700 762 S1018 676 1210 770 S1516 862 1720 680" />
      <path d="M-120 866 C214 718 456 954 728 862 S1044 774 1238 868 S1538 960 1720 774" />
      <path d="M-120 970 C236 816 478 1050 756 962 S1070 870 1266 966 S1558 1054 1720 870" />
    </g>
    <use href="#ambient-wave-contours" className="ambient-wave-lines" />
    <use href="#ambient-wave-contours" className="ambient-wave-shadow" y="5" />
    <use href="#ambient-wave-contours" className="ambient-wave-highlight" y="-3" />
  </svg>
);

export default AmbientWaves;
