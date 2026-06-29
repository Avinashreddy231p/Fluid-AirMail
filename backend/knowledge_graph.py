from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
import models
from collections import defaultdict

async def get_user_knowledge_graph(user: models.User, db: AsyncSession):
    # Base node: The User
    nodes = [{"id": f"u_{user.id}", "label": user.username or user.email, "group": "user"}]
    links = []
    
    # Contacts
    res = await db.execute(select(models.Contact).where(models.Contact.owner_id == user.id))
    contacts = res.scalars().all()
    
    contact_emails = set()
    for c in contacts:
        cid = f"c_{c.id}"
        contact_emails.add(c.contact_email)
        nodes.append({"id": cid, "label": c.name or c.contact_email, "group": "contact"})
        links.append({"source": f"u_{user.id}", "target": cid, "value": 1})
        
    # Sent Mails analysis
    res_mail = await db.execute(
        select(models.Mail.recipient_email, models.Mail.recipient_name)
        .where(models.Mail.sender_id == user.id)
    )
    sent_mails = res_mail.all()
    
    email_freq = defaultdict(int)
    name_map = {}
    for email, name in sent_mails:
        if email:
            email_freq[email] += 1
            name_map[email] = name
        
    for email, freq in email_freq.items():
        if email not in contact_emails and freq >= 1: 
            nid = f"e_{email}"
            # ensure node not added multiple times
            if not any(n['id'] == nid for n in nodes):
                nodes.append({"id": nid, "label": name_map[email] or email, "group": "frequent"})
            links.append({"source": f"u_{user.id}", "target": nid, "value": freq})
                
    return {"nodes": nodes, "links": links}
