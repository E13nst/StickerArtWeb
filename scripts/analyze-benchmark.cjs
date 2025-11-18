/**
 * 📊 Анализатор результатов бенчмарка
 * 
 * Скрипт для сравнения результатов бенчмарков с базовой линией
 * и генерации отчета с рекомендациями
 */

const fs = require('fs');
const path = require('path');

// Базовые пороговые значения (baseline)
const BASELINE = {
  timing: {
    timeToFirstSticker: 3000,      // 3s
    timeToFirst6Stickers: 4000,    // 4s
    timeToAll20Stickers: 8000,     // 8s
    firstContentfulPaint: 1800,    // 1.8s
    largestContentfulPaint: 2500,  // 2.5s
    timeToInteractive: 3800        // 3.8s
  },
  network: {
    totalRequests: 50,
    duplicateRequests: 5,
    failedRequests: 0,
    totalBytesTransferred: 5 * 1024 * 1024, // 5MB
    averageResponseTime: 200,
    maxConcurrency: 30
  },
  rendering: {
    averageFPS: 30,
    minFPS: 24,
    layoutShifts: 0.1,
    longTasks: 10,
    domNodes: 3000
  },
  resources: {
    jsHeapSize: 100, // MB
    canvasContexts: 20
  },
  caching: {
    cacheEfficiency: 50 // %
  }
};

// Веса для расчета общего скора
const WEIGHTS = {
  timing: 0.4,
  network: 0.25,
  rendering: 0.2,
  resources: 0.1,
  caching: 0.05
};

/**
 * Загружает результаты последнего бенчмарка из playwright report
 */
function loadBenchmarkResults() {
  try {
    const reportPath = path.join(__dirname, '..', 'test-results', 'results.json');
    
    if (!fs.existsSync(reportPath)) {
      console.log('❌ Результаты бенчмарка не найдены. Запустите тест сначала.');
      process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    return data;
  } catch (error) {
    console.error('❌ Ошибка чтения результатов:', error.message);
    process.exit(1);
  }
}

/**
 * Вычисляет скор метрики (0-100, где 100 - отлично)
 */
function calculateMetricScore(actual, baseline, lowerIsBetter = true) {
  if (lowerIsBetter) {
    if (actual <= baseline) return 100;
    const ratio = actual / baseline;
    return Math.max(0, 100 - (ratio - 1) * 100);
  } else {
    if (actual >= baseline) return 100;
    const ratio = actual / baseline;
    return Math.max(0, ratio * 100);
  }
}

/**
 * Анализирует метрики времени загрузки
 */
function analyzeTimingMetrics(metrics) {
  const scores = {
    ttfs: calculateMetricScore(metrics.timeToFirstSticker, BASELINE.timing.timeToFirstSticker),
    ttf6: calculateMetricScore(metrics.timeToFirst6Stickers, BASELINE.timing.timeToFirst6Stickers),
    tta20: calculateMetricScore(metrics.timeToAll20Stickers, BASELINE.timing.timeToAll20Stickers),
    fcp: calculateMetricScore(metrics.firstContentfulPaint, BASELINE.timing.firstContentfulPaint),
    lcp: calculateMetricScore(metrics.largestContentfulPaint, BASELINE.timing.largestContentfulPaint),
    tti: calculateMetricScore(metrics.timeToInteractive, BASELINE.timing.timeToInteractive)
  };
  
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  
  return {
    scores,
    average: avgScore,
    grade: getGrade(avgScore)
  };
}

/**
 * Анализирует сетевые метрики
 */
function analyzeNetworkMetrics(metrics) {
  const scores = {
    requests: calculateMetricScore(metrics.totalRequests, BASELINE.network.totalRequests),
    duplicates: calculateMetricScore(metrics.duplicateRequests, BASELINE.network.duplicateRequests),
    failed: calculateMetricScore(metrics.failedRequests, BASELINE.network.failedRequests),
    bytes: calculateMetricScore(metrics.totalBytesTransferred, BASELINE.network.totalBytesTransferred),
    responseTime: calculateMetricScore(metrics.averageResponseTime, BASELINE.network.averageResponseTime),
    concurrency: calculateMetricScore(metrics.maxConcurrency, BASELINE.network.maxConcurrency)
  };
  
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  
  return {
    scores,
    average: avgScore,
    grade: getGrade(avgScore)
  };
}

/**
 * Анализирует метрики рендеринга
 */
function analyzeRenderingMetrics(metrics) {
  const scores = {
    fps: calculateMetricScore(metrics.averageFPS, BASELINE.rendering.averageFPS, false),
    minFps: calculateMetricScore(metrics.minFPS, BASELINE.rendering.minFPS, false),
    cls: calculateMetricScore(metrics.layoutShifts, BASELINE.rendering.layoutShifts),
    longTasks: calculateMetricScore(metrics.longTasks, BASELINE.rendering.longTasks),
    domNodes: calculateMetricScore(metrics.domNodes, BASELINE.rendering.domNodes)
  };
  
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  
  return {
    scores,
    average: avgScore,
    grade: getGrade(avgScore)
  };
}

/**
 * Преобразует числовой скор в буквенную оценку
 */
function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Получает эмодзи для оценки
 */
function getGradeEmoji(grade) {
  const emojis = { 'A': '🏆', 'B': '✅', 'C': '⚠️', 'D': '❌', 'F': '💀' };
  return emojis[grade] || '❓';
}

/**
 * Генерирует список рекомендаций на основе метрик
 */
function generateRecommendations(results) {
  const recommendations = [];
  
  // Анализ времени загрузки
  if (results.timing.scores.ttfs < 70) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Loading',
      issue: 'Медленная загрузка первого стикера',
      suggestion: 'Оптимизируйте критический путь рендеринга, используйте preload для первого стикера'
    });
  }
  
  if (results.timing.scores.lcp < 70) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Core Web Vitals',
      issue: 'Медленный LCP',
      suggestion: 'Оптимизируйте самый большой элемент контента (изображения, размер, CDN)'
    });
  }
  
  // Анализ сети
  if (results.network.scores.duplicates < 80) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Network',
      issue: 'Дублирующиеся запросы',
      suggestion: 'Улучшите систему кеширования, добавьте dedupe логику в imageLoader'
    });
  }
  
  if (results.network.scores.bytes < 70) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Network',
      issue: 'Большой объем данных',
      suggestion: 'Сжимайте изображения, используйте WebP, lazy loading'
    });
  }
  
  if (results.network.scores.concurrency < 70) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Network',
      issue: 'Высокая параллельность запросов',
      suggestion: 'Используйте request queueing, ограничьте одновременные запросы'
    });
  }
  
  // Анализ рендеринга
  if (results.rendering.scores.fps < 70) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Rendering',
      issue: 'Низкий FPS',
      suggestion: 'Используйте CSS transforms, will-change, оптимизируйте анимации'
    });
  }
  
  if (results.rendering.scores.cls < 70) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Core Web Vitals',
      issue: 'Высокий Layout Shift',
      suggestion: 'Указывайте размеры для изображений, используйте skeleton loaders'
    });
  }
  
  if (results.rendering.scores.longTasks < 70) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Rendering',
      issue: 'Много долгих задач',
      suggestion: 'Разбивайте большие задачи, используйте Web Workers'
    });
  }
  
  return recommendations.sort((a, b) => {
    const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priority[a.priority] - priority[b.priority];
  });
}

/**
 * Выводит красивый отчет в консоль
 */
function printAnalysisReport(results, recommendations) {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 АНАЛИЗ РЕЗУЛЬТАТОВ БЕНЧМАРКА');
  console.log('═'.repeat(80) + '\n');
  
  // Общий скор
  const overallScore = (
    results.timing.average * WEIGHTS.timing +
    results.network.average * WEIGHTS.network +
    results.rendering.average * WEIGHTS.rendering
  );
  const overallGrade = getGrade(overallScore);
  
  console.log('🎯 ОБЩАЯ ОЦЕНКА:');
  console.log(`   ${getGradeEmoji(overallGrade)} ${overallGrade} (${overallScore.toFixed(1)}/100)`);
  console.log('');
  
  // Детальные оценки по категориям
  console.log('📈 ОЦЕНКИ ПО КАТЕГОРИЯМ:');
  console.log('─'.repeat(80));
  
  const categories = [
    { name: 'Время загрузки', data: results.timing, weight: WEIGHTS.timing },
    { name: 'Сеть', data: results.network, weight: WEIGHTS.network },
    { name: 'Рендеринг', data: results.rendering, weight: WEIGHTS.rendering }
  ];
  
  categories.forEach(cat => {
    const emoji = getGradeEmoji(cat.data.grade);
    const bar = '█'.repeat(Math.floor(cat.data.average / 5));
    console.log(`   ${emoji} ${cat.name.padEnd(20)} ${cat.data.grade} (${cat.data.average.toFixed(1)}/100) ${bar}`);
  });
  console.log('');
  
  // Детали по каждой категории
  console.log('🔍 ДЕТАЛЬНЫЙ АНАЛИЗ:');
  console.log('─'.repeat(80));
  
  console.log('\n   ⏱️  ВРЕМЯ ЗАГРУЗКИ:');
  Object.entries(results.timing.scores).forEach(([key, score]) => {
    const status = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
    console.log(`      ${status} ${key.toUpperCase().padEnd(6)} ${score.toFixed(0).padStart(3)}/100`);
  });
  
  console.log('\n   🌐 СЕТЬ:');
  Object.entries(results.network.scores).forEach(([key, score]) => {
    const status = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
    console.log(`      ${status} ${key.padEnd(12)} ${score.toFixed(0).padStart(3)}/100`);
  });
  
  console.log('\n   🎨 РЕНДЕРИНГ:');
  Object.entries(results.rendering.scores).forEach(([key, score]) => {
    const status = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
    console.log(`      ${status} ${key.padEnd(12)} ${score.toFixed(0).padStart(3)}/100`);
  });
  console.log('');
  
  // Рекомендации
  if (recommendations.length > 0) {
    console.log('💡 РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ:');
    console.log('─'.repeat(80));
    
    recommendations.forEach((rec, i) => {
      const priorityEmoji = rec.priority === 'HIGH' ? '🔥' : rec.priority === 'MEDIUM' ? '⚡' : '💡';
      console.log(`\n   ${i + 1}. ${priorityEmoji} [${rec.priority}] ${rec.category}: ${rec.issue}`);
      console.log(`      → ${rec.suggestion}`);
    });
    console.log('');
  } else {
    console.log('✨ ОТЛИЧНО! Дополнительных рекомендаций нет.\n');
  }
  
  console.log('═'.repeat(80));
  console.log('✅ АНАЛИЗ ЗАВЕРШЕН');
  console.log('═'.repeat(80) + '\n');
}

/**
 * Сохраняет результаты анализа в файл
 */
function saveAnalysisResults(results, recommendations) {
  const outputPath = path.join(__dirname, '..', 'test-results', 'benchmark-analysis.json');
  
  const output = {
    timestamp: new Date().toISOString(),
    overallScore: (
      results.timing.average * WEIGHTS.timing +
      results.network.average * WEIGHTS.network +
      results.rendering.average * WEIGHTS.rendering
    ),
    categories: {
      timing: results.timing,
      network: results.network,
      rendering: results.rendering
    },
    recommendations,
    baseline: BASELINE
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`💾 Результаты сохранены в ${outputPath}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🚀 Запуск анализа бенчмарка...\n');
  
  // Для примера используем моковые данные
  // В реальности нужно парсить результаты из Playwright report
  const mockMetrics = {
    timing: {
      timeToFirstSticker: 2500,
      timeToFirst6Stickers: 4500,
      timeToAll20Stickers: 9000,
      firstContentfulPaint: 1600,
      largestContentfulPaint: 3000,
      timeToInteractive: 4000
    },
    network: {
      totalRequests: 75,
      duplicateRequests: 8,
      failedRequests: 0,
      totalBytesTransferred: 6 * 1024 * 1024,
      averageResponseTime: 250,
      maxConcurrency: 35
    },
    rendering: {
      averageFPS: 45,
      minFPS: 28,
      layoutShifts: 0.15,
      longTasks: 12,
      domNodes: 2800
    }
  };
  
  // Анализируем каждую категорию
  const results = {
    timing: analyzeTimingMetrics(mockMetrics.timing),
    network: analyzeNetworkMetrics(mockMetrics.network),
    rendering: analyzeRenderingMetrics(mockMetrics.rendering)
  };
  
  // Генерируем рекомендации
  const recommendations = generateRecommendations(results);
  
  // Выводим отчет
  printAnalysisReport(results, recommendations);
  
  // Сохраняем результаты
  saveAnalysisResults(results, recommendations);
  
  // Exit code на основе общего скора
  const overallScore = (
    results.timing.average * WEIGHTS.timing +
    results.network.average * WEIGHTS.network +
    results.rendering.average * WEIGHTS.rendering
  );
  
  if (overallScore < 60) {
    console.log('❌ Производительность ниже приемлемого уровня');
    process.exit(1);
  } else if (overallScore < 80) {
    console.log('⚠️  Производительность требует улучшений');
    process.exit(0);
  } else {
    console.log('✅ Отличная производительность!');
    process.exit(0);
  }
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = {
  calculateMetricScore,
  analyzeTimingMetrics,
  analyzeNetworkMetrics,
  analyzeRenderingMetrics,
  generateRecommendations,
  getGrade
};

