import { useEffect, useState } from 'react';
import { inr } from '../utils';
import { useCountUp } from '../hooks';

const MAX_TILT = 13; // degrees

/**
 * The dashboard's centrepiece: a pair of scales. The side with more money in it sinks,
 * so "owed to you" (green, right) vs "you owe" (coral, left) reads before any number does.
 */
export default function BalanceBeam({ owe, owed }) {
  const total = owe + owed;
  const target = total === 0 ? 0 : ((owed - owe) / total) * MAX_TILT;

  // Start level, then settle into the real tilt once mounted (the transition does the animation).
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAngle(target), 120);
    return () => clearTimeout(id);
  }, [target]);

  const oweShown = useCountUp(owe);
  const owedShown = useCountUp(owed);
  const net = owed - owe;

  const ARM = 138;
  const ROPE = 74;
  const beamStyle = { transform: `translate(200px, 52px) rotate(${angle}deg)` };
  // Each pan counter-rotates so it hangs straight down while the beam tilts.
  const pan = (x) => ({ transform: `translate(${x}px, 0px) rotate(${-angle}deg)` });

  return (
    <section
      aria-label="Your balance"
      className="relative overflow-hidden rounded-[2rem] bg-hero p-6 text-on-hero sm:p-8"
    >
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="order-2 md:order-1">
          <p className="text-sm font-medium text-hero-muted">You owe</p>
          <p className="mt-1 font-display text-4xl font-bold tracking-tight text-hero-neg sm:text-5xl">
            {inr(oweShown)}
          </p>
        </div>

        <svg
          viewBox="0 0 400 190"
          className="order-1 mx-auto w-full max-w-[340px] md:order-2"
          role="img"
          aria-label={
            net === 0
              ? 'Scales are level: you are all settled up'
              : net > 0
                ? `Scales tip toward money owed to you: ${inr(owed)} owed to you, ${inr(owe)} you owe`
                : `Scales tip toward money you owe: ${inr(owe)} you owe, ${inr(owed)} owed to you`
          }
        >
          {/* stand */}
          <path d="M200 52v108" stroke="#aeb3e0" strokeWidth="5" strokeLinecap="round" />
          <path d="M150 168h100" stroke="#aeb3e0" strokeWidth="6" strokeLinecap="round" />

          <g className="beam" style={beamStyle}>
            <path d={`M${-ARM} 0H${ARM}`} stroke="#f2f3ff" strokeWidth="6" strokeLinecap="round" />

            <g className="beam" style={pan(-ARM)}>
              <path d={`M0 0L-34 ${ROPE}M0 0L34 ${ROPE}`} stroke="#aeb3e0" strokeWidth="2" />
              <path
                d={`M-44 ${ROPE}h88a44 30 0 0 1-88 0z`}
                fill="#ff9a8c"
                transform={`translate(0 0)`}
              />
              <text x="0" y={ROPE + 21} textAnchor="middle" fontSize="15" fill="#3a0d08" fontWeight="700">
                owe
              </text>
            </g>

            <g className="beam" style={pan(ARM)}>
              <path d={`M0 0L-34 ${ROPE}M0 0L34 ${ROPE}`} stroke="#aeb3e0" strokeWidth="2" />
              <path d={`M-44 ${ROPE}h88a44 30 0 0 1-88 0z`} fill="#7ee2a8" />
              <text x="0" y={ROPE + 21} textAnchor="middle" fontSize="15" fill="#052e1a" fontWeight="700">
                owed
              </text>
            </g>
          </g>

          <circle cx="200" cy="52" r="9" fill="#f4b02a" />
        </svg>

        <div className="order-3 md:text-right">
          <p className="text-sm font-medium text-hero-muted">You are owed</p>
          <p className="mt-1 font-display text-4xl font-bold tracking-tight text-hero-pos sm:text-5xl">
            {inr(owedShown)}
          </p>
        </div>
      </div>

      <p className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-hero-muted">
        {net === 0 ? (
          'You are all settled up.'
        ) : (
          <>
            Overall,{' '}
            <strong className={net > 0 ? 'text-hero-pos' : 'text-hero-neg'}>
              {net > 0 ? `you are owed ${inr(net)}` : `you owe ${inr(-net)}`}
            </strong>{' '}
            across all your groups.
          </>
        )}
      </p>
    </section>
  );
}
