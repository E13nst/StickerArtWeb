import { FC } from 'react';
import './Frame76Default.css';

export interface Frame76TaskProgress {
  title: string;
  current: number;
  total: number;
  completed: boolean;
}

interface Frame76DefaultProps {
  tasks: Frame76TaskProgress[];
}

/**
 * Figma: #components → Frame 76 Default
 * Блок прогресса задач (2 колонки), который ранее рендерился внутри `DailyActivity`.
 */
export const Frame76Default: FC<Frame76DefaultProps> = ({ tasks }) => {
  return (
    <div
      data-figma-component="Frame 76 Default"
      data-react-component="Frame76Default"
      className="frame-76-container"
    >
      {tasks.map((task, index) => {
        const progress = task.total > 0 ? (task.current / task.total) * 100 : 0;
        const isCompleted = task.completed || task.current >= task.total;

        return (
          <div key={index} className="task-item">
            <p className="task-title">{task.title}</p>

            <div 
              className="progress-bar-container"
              style={{
                backgroundColor: isCompleted ? '#ee449f' : 'rgba(255, 255, 255, 1)'
              }}
            >
              {!isCompleted && (
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              )}

              <div className="progress-bar-label">
                <span
                  className="progress-text"
                  style={{
                    color: isCompleted ? '#ee449f' : '#ee449f'
                  }}
                >
                  {task.current}/{task.total}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
