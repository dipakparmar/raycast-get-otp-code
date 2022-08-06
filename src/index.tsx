import { ActionPanel, List, Action, showToast, Toast, Image, Icon, Clipboard } from "@raycast/api";

import { useSqlSMS } from "./useSql";
import { isPermissionError, PermissionErrorScreen } from "./errors";
import { SMS } from "./types";

export default function Command() {
  const sqlState = useSqlSMS();

  if (sqlState.error) {
    if (isPermissionError(sqlState.error)) {
      return <PermissionErrorScreen />;
    } else {
      showToast({
        style: Toast.Style.Failure,
        title: "Cannot search SMS",
        message: sqlState.error.message,
      });
    }
  }

  interface DetectOTP {
    code: string;
    found: boolean;
  }

  function DetectOTP(sms: SMS) {
    // remove URLs from SMS
    let text = sms.text.replace(/\b((https?|ftp|file):\/\/|www\.)[-A-Z0-9+&@#/%?=~_|$!:,.;]*[A-Z0-9+&@#/%=~_|$]/i, "");
    let found = false;
    let code = "";
    const patterns = [
      { id: 1, pattern: new RegExp(/^.*code is (\d+).*$/), description: "Your code is XXXX" },
      { id: 2, pattern: new RegExp(/^.*code is:(\d+).*$/), description: "Your code is:XXXX" },
      { id: 3, pattern: new RegExp(/^G-\d+$/), description: "G-XXXX" },
      { id: 4, pattern: new RegExp(/^.*code:(\d+).*$/), description: "code:XXXX" },
      { id: 5, pattern: new RegExp(/^.*verification code (\d+).*$/), description: "verification code XXXX" },
      {
        id: 6,
        pattern: new RegExp(/^.*One time password to access your account is (\d+).*$/),
        description: "One time password to access your account is XXXX",
      },
      { id: 7, pattern: new RegExp(/^.*code: (\d+).*$/), description: "code: XXXX" },
      {
        id: 8,
        pattern: new RegExp(/^.*(\d+) is your Microsoft account verification.*$/),
        description: "XXXX is your Microsoft account verification code",
      },
      {
        id: 9,
        pattern: new RegExp(/^.*code de vérification est (\d+).*$/),
        description: "XXXX is your verification code",
      },
    ];

    // skip now-empty messages
    text = text.trim();
    if (text.length === 0) {
      console.log("Skipping empty message");
    } else {
      // find patterns in SMS

      for (const pattern of patterns) {
        if (text !== null && text.length > 0 && pattern.pattern.test(text)) {
          found = true;
          console.log(`Found in pattern ${pattern.id}`);
          const codes = text.match(pattern.pattern) || "";
          if (codes.length > 1) {
            code = codes[1];
          } else {
            break;
          }
          return { code, found };
        }
      }
      return { code, found };
    }
    return { code: "", found: false };
  }

  async function MarkUnread(sms: SMS) {
    const { ROWID: id } = sms;
    console.log(`Marking ${id} SMS as unread`);
    showToast({
      style: Toast.Style.Success,
      title: "Success 🎊",
      message: `Message ${id} Marked as unread!`,
    });
  }

  async function CopyOTP(sms: SMS) {
    const { code, found } = DetectOTP(sms);
    if (found) {
      showToast({
        style: Toast.Style.Success,
        title: "Success 🥳",
        message: "Copied Code: " + code + " to your clipboard. 📋 ",
      });
      Clipboard.copy(code || "");
    } else {
      showToast({
        style: Toast.Style.Failure,
        title: "Failure 😭",
        message: "No OTP found in message. 🤔",
      });
    }
  }

  function iconBasedOnOTP(sms: SMS): Image.ImageLike {
    const { found } = DetectOTP(sms);
    if (found) {
      return Icon.Key;
    }
    return Icon.StopFilled;
  }

  const alreadyFound: { [key: string]: boolean | string } = {};
  const all_messages = sqlState.results || [];
  const sorted_messages = all_messages
    .filter((x) => {
      const foundInArr = alreadyFound[x.ROWID];
      if (!foundInArr) {
        const { code, found } = DetectOTP(x);
        console.log(`${x.ROWID} - ${found} - ${code}`);
        alreadyFound[x.ROWID] = found;
        alreadyFound[x.code] = code;
      }
      return !foundInArr;
    })
    .sort((a, b) => (a.message_date && b.message_date && a.message_date < b.message_date ? 1 : -1));

  const message_only_with_code = sorted_messages.filter((x) => (alreadyFound[x.ROWID]));

  return (
    <List
      isLoading={sqlState.isLoading}
      navigationTitle="Search SMS"
      enableFiltering={true}
      searchBarPlaceholder="Search SMS text"
      isShowingDetail
    >
      {message_only_with_code.length > 0 ? (
        message_only_with_code.map((sms) => (
          <List.Item
            key={sms.ROWID}
            icon={sms.is_read == 0 ? "✉️" : "📨"}
            title={sms.text}
            accessories={[
              {
                tooltip: sms.message_date,
                date: new Date(sms.message_date),
              },
            ]}
            detail={
              <List.Item.Detail
                markdown={sms.text}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Sender" text={sms.sender} />
                    <List.Item.Detail.Metadata.Label title="Recieved Date" text={sms.message_date} />
                    <List.Item.Detail.Metadata.Label title="Read Status" text={sms.is_read == 1 ? "✅" : "📦"} />
                    <List.Item.Detail.Metadata.Label title="Code" text={alreadyFound[sms.code].toString() || ""} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action title="📋 Copy OTP" onAction={() => CopyOTP(sms)} />
                {/* <Action.Push title="Show Details" target={<Detail markdown={sms.text + "\n\n" + sms.is_read} />} /> */}
                <Action title="📨 Mark Unread" onAction={() => MarkUnread(sms)} />
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.EmptyView
          title="No messages found with otp code in last 1 hour!"
        />
      )}

      {/* <List.Item
        icon="list-icon.png"
        title="Greeting"
        actions={
          <ActionPanel>
            <Action.Push title="Show Details" target={<Detail markdown="# Hey! 👋" />} />
          </ActionPanel>
        }
      /> */}
    </List>
  );
}
