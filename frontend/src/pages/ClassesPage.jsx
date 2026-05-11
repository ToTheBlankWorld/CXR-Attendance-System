import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users, BookOpen, ArrowRight } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { classesAPI } from '../services/api';

export const ClassesPage = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await classesAPI.getAll();
        setClasses(response.data);
      } catch (err) {
        console.error('Failed to fetch classes:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody className="h-48 animate-pulse bg-gray-100"></CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <p className="text-gray-500">Select a class to manage attendance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classes.map((cls) => (
          <Link to={`/classes/${cls.lecture_id}`} key={cls.lecture_id}>
            <Card className="hover:shadow-lg transition-all cursor-pointer group h-full border-t-4 border-t-[#0d7377]">
              <CardBody className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-[#0d7377] rounded-xl">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <span className="px-3 py-1 bg-[#e8f5f5] text-[#0d7377] text-sm font-medium rounded-full">
                    ID: {cls.lecture_id}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">{cls.subject}</h2>
                <p className="text-gray-500 mb-4">{cls.room_no}</p>

                <div className="flex items-center gap-6 mt-auto pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{cls.start_time} - {cls.end_time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{cls.student_count} students</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center text-[#0d7377] font-medium group-hover:gap-3 transition-all gap-2">
                  <span>View Details</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
