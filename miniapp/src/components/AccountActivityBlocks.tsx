import { FC } from 'react';
import './AccountActivityBlocks.css';

/** Задача активности с прогресс-баром (Figma ACCOUNT) */
export interface ActivityTask {
  id: string;
  title: string;
  progress: number;
  total: number;
  reward?: string;
  status: 'calm' | 'go-up' | 'active';
  onAction?: () => void;
  actionLabel?: string;
}

interface ActivityTaskItemProps {
  task: ActivityTask;
}

const ActivityTaskItem: FC<ActivityTaskItemProps> = ({ task }) => {
  const percent = task.total > 0 ? Math.min(100, (task.progress / task.total) * 100) : 0;
  const isComplete = task.progress >= task.total;

  return (
    <div className="activity-task">
      <div className="activity-task__header">
        <span className="activity-task__title">{task.title}</span>
        {task.reward && (
          <span className="activity-task__reward">{task.reward}</span>
        )}
      </div>
      <div className="activity-task__row">
        <div className="activity-task__progress-wrap">
          <div className="activity-task__progress-bg" />
          <div
            className="activity-task__progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="activity-task__count">
          {task.progress}/{task.total}
        </span>
        <div
          className={`activity-task__badge activity-task__badge--${task.status} ${isComplete ? 'activity-task__badge--complete' : ''}`}
        >
          {task.status === 'calm' && 'Calm'}
          {task.status === 'go-up' && 'Go Up'}
          {task.status === 'active' && 'Start'}
        </div>
      </div>
    </div>
  );
};

/** Mini block (Quest Stixly) — 177×176px */
interface QuestStixlyCardProps {
  title: string;
  description: string;
  onStart?: () => void;
}

export const QuestStixlyCard: FC<QuestStixlyCardProps> = ({
  title,
  description,
  onStart
}) => (
  <div className="quest-stixly-card">
    <div className="quest-stixly-card__info">
      <span className="quest-stixly-card__title">{title}</span>
      <span className="quest-stixly-card__description">{description}</span>
    </div>
    <button
      type="button"
      className="quest-stixly-card__button"
      onClick={onStart}
    >
      Start
    </button>
  </div>
);

/** Daily activity block */
interface DailyActivityBlockProps {
  tasks: ActivityTask[];
}

export const DailyActivityBlock: FC<DailyActivityBlockProps> = ({
  tasks
}) => (
  <div className="activity-block activity-block--daily">
    <h3 className="activity-block__title">Daily activity</h3>
    <div className="activity-block__progress-dots">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className={`activity-block__dot ${i < 9 ? 'activity-block__dot--filled' : ''}`}
        />
      ))}
    </div>
    <div className="activity-block__tasks">
      {tasks.map((task) => (
        <ActivityTaskItem
          key={task.id}
          task={task}
        />
      ))}
    </div>
  </div>
);

/** Global activity block */
interface GlobalActivityBlockProps {
  tasks: ActivityTask[];
}

export const GlobalActivityBlock: FC<GlobalActivityBlockProps> = ({
  tasks
}) => (
  <div className="activity-block activity-block--global">
    <h3 className="activity-block__title">Global activity</h3>
    <div className="activity-block__tasks">
      {tasks.map((task) => (
        <ActivityTaskItem key={task.id} task={task} />
      ))}
    </div>
  </div>
);
