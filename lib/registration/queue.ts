// A blocked lookup sent nothing and is safe to recheck with the overall Register button.
// Confirmed rejections require the explicit per-course Retry action. Unknown outcomes never requeue.
export function registrationQueue<T extends {course:{course_code:string}}>(items: T[], results: Record<string,{outcome:string}>, retryCode?: string): T[] {
  return items.filter(item => retryCode ? item.course.course_code === retryCode : !results[item.course.course_code] || results[item.course.course_code].outcome === 'blocked');
}
