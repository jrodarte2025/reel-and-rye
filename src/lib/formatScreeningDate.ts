export function formatScreeningDate(screening: { date: string; time: string }): string {
  try {
    const [timePart, modifier] = screening.time.split(' ')
    const [rawHour] = timePart.split(':')
    let hour = parseInt(rawHour, 10)
    if (modifier === 'PM' && hour !== 12) hour += 12
    if (modifier === 'AM' && hour === 12) hour = 0
    const dateObj = new Date(`${screening.date}T${hour.toString().padStart(2, '0')}:00:00`)
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    return `${formattedDate} \u2013 ${screening.time}`
  } catch {
    return `${screening.date} \u2013 ${screening.time}`
  }
}
