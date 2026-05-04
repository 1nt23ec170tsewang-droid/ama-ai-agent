import { Calendar, Users, Target, FileText, Clock, ExternalLink, CheckCircle } from 'lucide-react';

interface MeetingBrief {
  id: string;
  title: string;
  time: string;
  date: string;
  duration: string;
  attendees: { id: string; name: string; role: string; context?: string }[];
  objectives: { id: string; text: string }[];
  agenda: { id: string; text: string }[];
  background: string;
  talkingPoints: { id: string; text: string }[];
  decisionsNeeded: { id: string; text: string }[];
  materials: { id: string; name: string; url: string }[];
  aiNotes: { id: string; text: string }[];
}

const upcomingMeeting: MeetingBrief = {
  id: '1',
  title: 'Board Meeting - Q2 Review',
  time: '9:00 AM',
  date: 'Tomorrow, May 1',
  duration: '2 hours',
  attendees: [
    { id: '1', name: 'Sarah Chen', role: 'Board Chair', context: 'Previously raised concerns about burn rate' },
    { id: '2', name: 'Alex Kim', role: 'Board Member (Finance)', context: 'Expects detailed revenue projections' },
    { id: '3', name: 'Maria Garcia', role: 'Board Member (Product)', context: 'Interested in product roadmap updates' },
    { id: '4', name: 'James Lee', role: 'Board Observer', context: 'First meeting as observer' },
  ],
  objectives: [
    { id: '1', text: 'Present Q2 financial results and Q3 projections' },
    { id: '2', text: 'Get approval for engineering headcount increase' },
    { id: '3', text: 'Review product roadmap and upcoming launches' },
  ],
  agenda: [
    { id: '1', text: 'Opening remarks (5 min)' },
    { id: '2', text: 'Financial review - Q2 actuals vs. budget (20 min)' },
    { id: '3', text: 'Q3 revenue projections and assumptions (15 min)' },
    { id: '4', text: 'Engineering org growth proposal (20 min)' },
    { id: '5', text: 'Product roadmap presentation (30 min)' },
    { id: '6', text: 'Open discussion and Q&A (20 min)' },
    { id: '7', text: 'Closed session - executive compensation (10 min)' },
  ],
  background: 'This is the quarterly board meeting. Last quarter, the board expressed concerns about increasing burn rate and requested more conservative hiring plans. We exceeded our Q2 revenue target by 12%, which should help make the case for the engineering headcount increase.',
  talkingPoints: [
    { id: '1', text: 'Lead with the revenue win - 12% above target gives us credibility' },
    { id: '2', text: 'Address burn rate concerns proactively before they come up' },
    { id: '3', text: 'Engineering headcount is for revenue-generating product teams, not overhead' },
    { id: '4', text: 'Product roadmap aligns with feedback from last quarter' },
    { id: '5', text: 'James Lee is new - make him feel welcome, provide context when needed' },
  ],
  decisionsNeeded: [
    { id: '1', text: 'Approval for 5 additional engineering hires ($750K budget impact)' },
    { id: '2', text: 'Sign-off on Q3 marketing spend increase' },
    { id: '3', text: 'Executive compensation adjustments' },
  ],
  materials: [
    { id: '1', name: 'Q2 Financial Report.pdf', url: '#' },
    { id: '2', name: 'Engineering Hiring Proposal.pdf', url: '#' },
    { id: '3', name: 'Product Roadmap Slides.pdf', url: '#' },
    { id: '4', name: 'Board Deck (Master).pdf', url: '#' },
  ],
  aiNotes: [
    { id: '1', text: 'Sarah Chen emailed yesterday asking about customer churn - be prepared to address' },
    { id: '2', text: 'Alex Kim will likely ask about CAC trends - include in presentation' },
    { id: '3', text: 'Consider mentioning the recent partnership win with Acme Corp' },
    { id: '4', text: 'Reminder: James Lee needs background on last quarter\'s product delays' },
  ],
};

const allMeetings = [
  { id: '1', title: 'Board Meeting - Q2 Review', time: 'Tomorrow 9:00 AM', hasPrep: true },
  { id: '2', title: 'Product Review', time: 'Tomorrow 11:30 AM', hasPrep: true },
  { id: '3', title: 'Investor Call - Series B', time: 'May 2, 2:00 PM', hasPrep: false },
  { id: '4', title: 'Team All-Hands', time: 'May 3, 10:00 AM', hasPrep: true },
];

export function MeetingPrep() {
  return (
    <div className="grid grid-cols-[300px_1fr] gap-6 h-full">
      <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-auto">
        <h3 className="font-medium mb-4">Upcoming Meetings</h3>
        <div className="space-y-2">
          {allMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                meeting.id === '1'
                  ? 'bg-blue-50 border-blue-200'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-medium text-sm">{meeting.title}</span>
                {meeting.hasPrep && (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                )}
              </div>
              <span className="text-xs text-slate-600">{meeting.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-medium mb-2">{upcomingMeeting.title}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{upcomingMeeting.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{upcomingMeeting.time} ({upcomingMeeting.duration})</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 shadow-lg">
                Export to PDF
              </button>
              <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                Edit
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {upcomingMeeting.aiNotes.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" />
                <h3 className="font-medium text-purple-900">AI Context & Reminders</h3>
              </div>
              <div className="space-y-2">
                {upcomingMeeting.aiNotes.map((note) => (
                  <div key={note.id} className="flex items-start gap-2">
                    <span className="text-purple-600">•</span>
                    <span className="text-sm text-purple-900">{note.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-3">
              <Target className="w-5 h-5 text-blue-600" />
              Meeting Objectives
            </h3>
            <div className="space-y-2">
              {upcomingMeeting.objectives.map((obj, idx) => (
                <div key={obj.id} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                  <span className="text-blue-600 font-medium">{idx + 1}.</span>
                  <span className="text-slate-700">{obj.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-3">
              <Users className="w-5 h-5 text-green-600" />
              Attendees ({upcomingMeeting.attendees.length})
            </h3>
            <div className="space-y-2">
              {upcomingMeeting.attendees.map((attendee) => (
                <div key={attendee.id} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                      {attendee.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{attendee.name}</div>
                      <div className="text-sm text-slate-600">{attendee.role}</div>
                      {attendee.context && (
                        <div className="text-sm text-blue-700 mt-1 bg-blue-50 px-2 py-1 rounded inline-block">
                          💡 {attendee.context}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Background & Context</h3>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-slate-700 leading-relaxed">{upcomingMeeting.background}</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Agenda</h3>
            <div className="space-y-2">
              {upcomingMeeting.agenda.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <span className="text-sm font-medium text-slate-500 w-6">{idx + 1}</span>
                  <span className="text-slate-700 flex-1">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Your Talking Points</h3>
            <div className="space-y-2">
              {upcomingMeeting.talkingPoints.map((point) => (
                <div key={point.id} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-blue-600">→</span>
                  <span className="text-slate-700">{point.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Decisions Needed</h3>
            <div className="space-y-2">
              {upcomingMeeting.decisionsNeeded.map((decision) => (
                <div key={decision.id} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">{decision.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-3">
              <FileText className="w-5 h-5 text-purple-600" />
              Materials & Documents
            </h3>
            <div className="space-y-2">
              {upcomingMeeting.materials.map((material) => (
                <div key={material.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-700">{material.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
