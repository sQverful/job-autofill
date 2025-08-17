import React, { useState } from 'react';
import { Input, FormField, Textarea, Button, Select } from '@extension/ui';
import type { UserProfile, ValidationError, WorkExperience, Education, Certification } from '@extension/shared';

interface ProfessionalInfoFormProps {
  profile: UserProfile;
  errors: ValidationError[];
  onChange: (updates: Partial<UserProfile['professionalInfo']>) => void;
}

export const ProfessionalInfoForm: React.FC<ProfessionalInfoFormProps> = ({
  profile,
  errors,
  onChange,
}) => {
  const [newSkill, setNewSkill] = useState('');

  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleSummaryChange = (value: string) => {
    onChange({ summary: value });
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !profile.professionalInfo.skills.includes(newSkill.trim())) {
      onChange({
        skills: [...profile.professionalInfo.skills, newSkill.trim()],
      });
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onChange({
      skills: profile.professionalInfo.skills.filter(skill => skill !== skillToRemove),
    });
  };

  const handleAddWorkExperience = () => {
    const newExperience: WorkExperience = {
      id: `work_${Date.now()}`,
      company: '',
      position: '',
      startDate: new Date(),
      isCurrent: false,
      description: '',
      location: '',
    };
    onChange({
      workExperience: [...profile.professionalInfo.workExperience, newExperience],
    });
  };

  const handleUpdateWorkExperience = (index: number, updates: Partial<WorkExperience>) => {
    const updatedExperience = profile.professionalInfo.workExperience.map((exp, i) =>
      i === index ? { ...exp, ...updates } : exp
    );
    onChange({ workExperience: updatedExperience });
  };

  const handleRemoveWorkExperience = (index: number) => {
    const updatedExperience = profile.professionalInfo.workExperience.filter((_, i) => i !== index);
    onChange({ workExperience: updatedExperience });
  };

  const handleAddEducation = () => {
    const newEducation: Education = {
      id: `edu_${Date.now()}`,
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: new Date(),
      graduationDate: new Date(),
      gpa: '',
      location: '',
    };
    onChange({
      education: [...profile.professionalInfo.education, newEducation],
    });
  };

  const handleUpdateEducation = (index: number, updates: Partial<Education>) => {
    const updatedEducation = profile.professionalInfo.education.map((edu, i) =>
      i === index ? { ...edu, ...updates } : edu
    );
    onChange({ education: updatedEducation });
  };

  const handleRemoveEducation = (index: number) => {
    const updatedEducation = profile.professionalInfo.education.filter((_, i) => i !== index);
    onChange({ education: updatedEducation });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Professional Information
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Add your work experience, education, and skills to automatically populate job applications.
        </p>
      </div>

      {/* Professional Summary */}
      <div>
        <FormField
          label="Professional Summary"
          error={getFieldError('professionalInfo.summary')}
          description="A brief overview of your professional background and key achievements"
        >
          <Textarea
            value={profile.professionalInfo.summary || ''}
            onChange={(e) => handleSummaryChange(e.target.value)}
            placeholder="Experienced software engineer with 5+ years developing web applications..."
            rows={4}
          />
        </FormField>
      </div>

      {/* Skills */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Skills
        </h4>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add a skill (e.g., JavaScript, Project Management)"
              onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
            />
            <Button onClick={handleAddSkill} disabled={!newSkill.trim()}>
              Add
            </Button>
          </div>
          
          {profile.professionalInfo.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.professionalInfo.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {skill}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Work Experience */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
            Work Experience
          </h4>
          <Button onClick={handleAddWorkExperience} variant="outline">
            Add Experience
          </Button>
        </div>

        <div className="space-y-6">
          {profile.professionalInfo.workExperience.map((experience, index) => (
            <div key={experience.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Experience #{index + 1}
                </h5>
                <Button
                  onClick={() => handleRemoveWorkExperience(index)}
                  variant="outline"
                  size="sm"
                >
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Company" required>
                  <Input
                    value={experience.company}
                    onChange={(e) => handleUpdateWorkExperience(index, { company: e.target.value })}
                    placeholder="Company name"
                  />
                </FormField>

                <FormField label="Position" required>
                  <Input
                    value={experience.position}
                    onChange={(e) => handleUpdateWorkExperience(index, { position: e.target.value })}
                    placeholder="Job title"
                  />
                </FormField>

                <FormField label="Location">
                  <Input
                    value={experience.location || ''}
                    onChange={(e) => handleUpdateWorkExperience(index, { location: e.target.value })}
                    placeholder="City, State"
                  />
                </FormField>

                <FormField label="Start Date" required>
                  <Input
                    type="date"
                    value={experience.startDate.toISOString().split('T')[0]}
                    onChange={(e) => handleUpdateWorkExperience(index, { startDate: new Date(e.target.value) })}
                  />
                </FormField>

                {!experience.isCurrent && (
                  <FormField label="End Date">
                    <Input
                      type="date"
                      value={experience.endDate?.toISOString().split('T')[0] || ''}
                      onChange={(e) => handleUpdateWorkExperience(index, { endDate: new Date(e.target.value) })}
                    />
                  </FormField>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`current-${index}`}
                    checked={experience.isCurrent}
                    onChange={(e) => handleUpdateWorkExperience(index, { isCurrent: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor={`current-${index}`} className="text-sm text-gray-700 dark:text-gray-300">
                    Current position
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <FormField label="Description">
                  <Textarea
                    value={experience.description || ''}
                    onChange={(e) => handleUpdateWorkExperience(index, { description: e.target.value })}
                    placeholder="Describe your responsibilities and achievements..."
                    rows={3}
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Education */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
            Education
          </h4>
          <Button onClick={handleAddEducation} variant="outline">
            Add Education
          </Button>
        </div>

        <div className="space-y-6">
          {profile.professionalInfo.education.map((education, index) => (
            <div key={education.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Education #{index + 1}
                </h5>
                <Button
                  onClick={() => handleRemoveEducation(index)}
                  variant="outline"
                  size="sm"
                >
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Institution" required>
                  <Input
                    value={education.institution}
                    onChange={(e) => handleUpdateEducation(index, { institution: e.target.value })}
                    placeholder="University name"
                  />
                </FormField>

                <FormField label="Degree" required>
                  <Input
                    value={education.degree}
                    onChange={(e) => handleUpdateEducation(index, { degree: e.target.value })}
                    placeholder="Bachelor of Science"
                  />
                </FormField>

                <FormField label="Field of Study">
                  <Input
                    value={education.fieldOfStudy || ''}
                    onChange={(e) => handleUpdateEducation(index, { fieldOfStudy: e.target.value })}
                    placeholder="Computer Science"
                  />
                </FormField>

                <FormField label="Location">
                  <Input
                    value={education.location || ''}
                    onChange={(e) => handleUpdateEducation(index, { location: e.target.value })}
                    placeholder="City, State"
                  />
                </FormField>

                <FormField label="Start Date">
                  <Input
                    type="date"
                    value={education.startDate?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleUpdateEducation(index, { startDate: new Date(e.target.value) })}
                  />
                </FormField>

                <FormField label="Graduation Date">
                  <Input
                    type="date"
                    value={education.graduationDate?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleUpdateEducation(index, { graduationDate: new Date(e.target.value) })}
                  />
                </FormField>

                <FormField label="GPA">
                  <Input
                    value={education.gpa || ''}
                    onChange={(e) => handleUpdateEducation(index, { gpa: e.target.value })}
                    placeholder="3.8"
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};