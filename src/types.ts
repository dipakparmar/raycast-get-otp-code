// sample SMS Data
// ROWID: 10739,
// sender: '242226',
// service: 'SMS',
// message_date: '2022-08-02 22:51:48',
// text: 'Dipak, Your OTP code is 3245.'

export interface SMS {
    ROWID: string;
    sender: string;
    service: string;
    message_date: string;
    text: string;
    is_read: number;
    date_read: string;
    code: string;
}