export type User = { id:number; email:string; name:string; kind:'member'|'staff'; role:'admin'|'employee'|null; mustChangePassword:boolean };
export type Member = {id:number;name:string;phone:string;email:string;joinedAt:string};
export type Trainer = {id:number;name:string;workingDays:number[]};
export type PassType = {id:number;name:string;totalSessions:number;listPrice:number;validDays:number};
export type Pass = {id:number;memberId:number;memberName:string;typeId:number;typeName:string;purchasedOn:string;paidAmount:number;expiresOn:string;totalSessions:number;usedSessions:number;bookedSessions:number;remainingSessions:number;availableSessions:number;isUsable:boolean};
export type Reservation = {id:number;memberId:number;memberName:string;passId:number;typeName:string;trainerId:number;trainerName:string;startsAt:string;status:'booked'|'completed'|'cancelled'|'noshow';note:string};
export type Staff = {id:number;email:string;name:string;role:'admin'|'employee';isActive:boolean;mustChangePassword:boolean};
export type Dashboard = {membersCount:number;bookedCount:number;todayCount:number;expiringPasses:Pass[];trainerStats:{id:number;name:string;completedCount:number}[]};

export type Receipt = {id:number;fileName:string;mimeType:string;dataUrl:string;createdAt:string};
