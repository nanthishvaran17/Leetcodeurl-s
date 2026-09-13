import re

with open('e:/Leetcode Web/frontend/src/components/StaffVerificationSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if 'import { GlobalFilter }' not in content:
    content = content.replace('import { useNotification } from \'../context/NotificationContext\';', 'import { useNotification } from \'../context/NotificationContext\';\nimport { GlobalFilter } from \'./GlobalFilter\';')

# 2. Add options definitions before the form
options_code = '''
  const departmentOptions = departments.map((d: any) => ({
    value: String(d.id),
    label: f"{d.code} - {d.name}"
  }));

  const designationOptions = [
    { value: 'Assistant Professor', label: 'Assistant Professor' },
    { value: 'Associate Professor', label: 'Associate Professor' },
    { value: 'Professor', label: 'Professor' },
    { value: 'Head of Department (HOD)', label: 'Head of Department (HOD)' },
    { value: 'Faculty Mentor', label: 'Faculty Mentor' },
    { value: 'Class Advisor', label: 'Class Advisor' },
    { value: 'Lab Instructor / Programmer', label: 'Lab Instructor / Programmer' },
    { value: 'Placement Officer', label: 'Placement Officer' },
    { value: 'Institutional Administrator', label: 'Institutional Administrator' }
  ];

  const reportsToOptions = [
    { value: '', label: 'Select Reporting Manager / HOD...' },
    ...eligibleReportingManagers.map((rep: any) => ({
      value: String(rep.id),
      label: f"{rep.name} ({rep.designation})"
    }))
  ];
'''
options_code = options_code.replace('f"', '`').replace('"', '`')
if 'const designationOptions' not in content:
    content = content.replace('<form onSubmit={handleSubmit} className="space-y-5">', options_code + '\n        {/* Form Container */}\n        <form onSubmit={handleSubmit} className="space-y-5">')

# 3. Replace department select
dept_select = '''<select
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>'''
dept_global = '''<GlobalFilter
                value={String(departmentId)}
                onChange={(val) => setDepartmentId(Number(val))}
                options={departmentOptions}
                placeholder="Select Department..."
              />'''
content = content.replace(dept_select, dept_global)

# 4. Replace designation select
desig_select = '''<select
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Professor">Professor</option>
                <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                <option value="Faculty Mentor">Faculty Mentor</option>
                <option value="Class Advisor">Class Advisor</option>
                <option value="Lab Instructor / Programmer">Lab Instructor / Programmer</option>
                <option value="Placement Officer">Placement Officer</option>
                <option value="Institutional Administrator">Institutional Administrator</option>
              </select>'''
desig_global = '''<GlobalFilter
                value={designation}
                onChange={(val) => setDesignation(val)}
                options={designationOptions}
                placeholder="Select Designation..."
              />'''
content = content.replace(desig_select, desig_global)

# 5. Replace reports to select
reports_select = '''<select
                value={reportingToUserId}
                onChange={(e) => setReportingToUserId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Select Reporting Manager / HOD...</option>
                {eligibleReportingManagers.map((rep: any) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name} ({rep.designation})
                  </option>
                ))}
              </select>'''
reports_global = '''<GlobalFilter
                value={reportingToUserId}
                onChange={(val) => setReportingToUserId(val)}
                options={reportsToOptions}
                placeholder="Select Reporting Manager / HOD..."
              />'''
content = content.replace(reports_select, reports_global)

with open('e:/Leetcode Web/frontend/src/components/StaffVerificationSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Replaced selects with GlobalFilter successfully.')
