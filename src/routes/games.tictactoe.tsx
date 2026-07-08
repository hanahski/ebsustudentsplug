import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Hash, Trophy, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/games/tictactoe")({
  component: TicTacToePage,
  head: () => ({
    meta: [
      { title: "Tic-Tac-Toe vs AI — StudentsPlug" },
      { name: "description", content: "Play single-player Tic-Tac-Toe against an easy or hard AI opponent." },
    ],
  }),
});

type Cell = "X" | "O" | null;
type Board = Cell[];
type Difficulty = "easy" | "hard";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(b: Board): { winner: Cell; line: number[] | null } {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a], line };
  }
  return { winner: null, line: null };
}

function emptyIndices(b: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < 9; i++) if (!b[i]) out.push(i);
  return out;
}

// EASY: 70% random move, 30% chance to take a winning move if available.
function easyMove(b: Board, ai: "X" | "O"): number {
  const empties = emptyIndices(b);
  if (empties.length === 0) return -1;
  if (Math.random() < 0.3) {
    for (const i of empties) {
      const copy = b.slice();
      copy[i] = ai;
      if (winnerOf(copy).winner === ai) return i;
    }
  }
  return empties[Math.floor(Math.random() * empties.length)];
}

// HARD: perfect play via minimax.
function minimax(b: Board, player: "X" | "O", ai: "X" | "O"): { score: number; move: number } {
  const { winner } = winnerOf(b);
  if (winner === ai) return { score: 10, move: -1 };
  if (winner && winner !== ai) return { score: -10, move: -1 };
  const empties = emptyIndices(b);
  if (empties.length === 0) return { score: 0, move: -1 };

  const human: "X" | "O" = ai === "X" ? "O" : "X";
  let bestMove = empties[0];
  let bestScore = player === ai ? -Infinity : Infinity;

  for (const i of empties) {
    const copy = b.slice();
    copy[i] = player;
    const { score } = minimax(copy, player === ai ? human : ai, ai);
    const depthAdj = score - (player === ai ? empties.length : -empties.length) * 0;
    if (player === ai) {
      if (depthAdj > bestScore) { bestScore = depthAdj; bestMove = i; }
    } else {
      if (depthAdj < bestScore) { bestScore = depthAdj; bestMove = i; }
    }
  }
  return { score: bestScore, move: bestMove };
}

function hardMove(b: Board, ai: "X" | "O"): number {
  return minimax(b, ai, ai).move;
}

function TicTacToePage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [youAre] = useState<"X">("X"); // human is X, goes first
  const ai: "O" = "O";
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [score, setScore] = useState({ you: 0, ai: 0, draw: 0 });

  const { winner, line } = useMemo(() => winnerOf(board), [board]);
  const isDraw = !winner && board.every(Boolean);
  const gameOver = !!winner || isDraw;

  // AI move
  useEffect(() => {
    if (gameOver || turn !== ai) return;
    const timeout = setTimeout(() => {
      const move = difficulty === "hard" ? hardMove(board, ai) : easyMove(board, ai);
      if (move < 0) return;
      setBoard((b) => {
        if (b[move] || winnerOf(b).winner) return b;
        const copy = b.slice();
        copy[move] = ai;
        return copy;
      });
      setTurn("X");
    }, 450);
    return () => clearTimeout(timeout);
  }, [turn, board, difficulty, gameOver]);

  // Tally on game end
  useEffect(() => {
    if (!gameOver) return;
    setScore((s) => {
      if (winner === youAre) return { ...s, you: s.you + 1 };
      if (winner === ai) return { ...s, ai: s.ai + 1 };
      return { ...s, draw: s.draw + 1 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const play = (i: number) => {
    if (gameOver || turn !== youAre || board[i]) return;
    const copy = board.slice();
    copy[i] = youAre;
    setBoard(copy);
    setTurn(ai);
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setTurn("X");
  };

  const changeDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setBoard(Array(9).fill(null));
    setTurn("X");
    setScore({ you: 0, ai: 0, draw: 0 });
  };

  const status = winner
    ? winner === youAre ? "You win!" : "AI wins"
    : isDraw ? "Draw"
    : turn === youAre ? "Your turn" : "AI is thinking…";

  return (
    <div className="max-w-md mx-auto space-y-5">
      <Link to="/games" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Games
      </Link>

      <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-card">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 text-white flex items-center justify-center shadow-glow">
            <Hash className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold font-display">Tic-Tac-Toe</h1>
            <p className="text-xs text-muted-foreground">Single player. You are X, AI is O.</p>
          </div>
        </div>
      </header>

      <div className="inline-flex w-full p-1 rounded-full bg-muted border">
        {(["easy", "hard"] as const).map((d) => (
          <button
            key={d}
            onClick={() => changeDifficulty(d)}
            className={`flex-1 px-4 py-1.5 text-sm font-bold rounded-full capitalize transition ${
              difficulty === d ? "bg-background shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            {d} mode
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border bg-card p-3">
          <User className="w-4 h-4 mx-auto text-primary" />
          <div className="text-[10px] uppercase text-muted-foreground mt-1">You</div>
          <div className="font-bold text-lg">{score.you}</div>
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <Trophy className="w-4 h-4 mx-auto text-muted-foreground" />
          <div className="text-[10px] uppercase text-muted-foreground mt-1">Draw</div>
          <div className="font-bold text-lg">{score.draw}</div>
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <Bot className="w-4 h-4 mx-auto text-destructive" />
          <div className="text-[10px] uppercase text-muted-foreground mt-1">AI</div>
          <div className="font-bold text-lg">{score.ai}</div>
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-4 shadow-card">
        <div className="text-center text-sm font-semibold mb-3">{status}</div>
        <div className="grid grid-cols-3 gap-2 aspect-square">
          {board.map((cell, i) => {
            const inWin = line?.includes(i);
            const disabled = gameOver || turn !== youAre || !!cell;
            return (
              <button
                key={i}
                onClick={() => play(i)}
                disabled={disabled}
                className={`rounded-2xl border text-4xl font-bold font-display flex items-center justify-center transition ${
                  inWin ? "bg-primary/20 border-primary text-primary" : "bg-background hover:bg-muted"
                } ${!cell && !disabled ? "hover:scale-[1.02]" : ""} ${cell === "X" ? "text-primary" : cell === "O" ? "text-destructive" : ""}`}
                aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ", empty"}`}
              >
                {cell}
              </button>
            );
          })}
        </div>
        <Button onClick={reset} variant="outline" className="w-full mt-4 rounded-full">
          <RotateCcw className="w-4 h-4 mr-2" /> New round
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Easy: mostly random moves. Hard: perfect play (minimax) — best you can do is a draw.
      </p>
    </div>
  );
}
