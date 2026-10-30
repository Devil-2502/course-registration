import { useState } from 'react'
import type { Course, Section } from '../api'
import AdminCourses from './AdminCourses'
import AdminPrerequisites from './AdminPrerequisites'
import AdminSections from './AdminSections'
import SectionRoster from './SectionRoster'

type View =
  | { name: 'courses' }
  | { name: 'sections'; course: Course }
  | { name: 'prerequisites'; course: Course }
  | { name: 'roster'; course: Course; section: Section }

// Khu quản trị (US-12, US-13): điều hướng giữa UI-09, UI-10, UI-11, UI-12
export default function Admin() {
  const [view, setView] = useState<View>({ name: 'courses' })
  const toCourses = () => setView({ name: 'courses' })
  if (view.name === 'prerequisites') return <AdminPrerequisites course={view.course} back={toCourses} />
  if (view.name === 'sections') {
    const course = view.course
    return <AdminSections course={course} back={toCourses} openRoster={section => setView({ name: 'roster', course, section })} />
  }
  if (view.name === 'roster') {
    const course = view.course
    return <SectionRoster section={view.section} back={() => setView({ name: 'sections', course })} />
  }
  return <AdminCourses
    openSections={course => setView({ name: 'sections', course })}
    openPrerequisites={course => setView({ name: 'prerequisites', course })}
  />
}
